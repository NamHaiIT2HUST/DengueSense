package eventx

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"github.com/nats-io/nats.go"
)

// Publisher phát sự kiện lên bus (docs/09 §7, ADR-0003).
type Publisher interface {
	// Publish phát phong bì CloudEvents lên subject mặc định (env.Type).
	Publish(ctx context.Context, env Envelope) error

	// PublishToSubject phát phong bì lên một subject tuỳ chỉnh (vd: DLQ.<type>).
	PublishToSubject(ctx context.Context, subject string, env Envelope) error

	// Close giải phóng tài nguyên/kết nối.
	Close() error
}

// JetStreamPublisher phát sự kiện lên NATS JetStream.
type JetStreamPublisher struct {
	nc *nats.Conn
	js nats.JetStreamContext
}

// NewJetStreamPublisher tạo publisher từ NATS URL hoặc kết nối có sẵn.
func NewJetStreamPublisher(url string, opts ...nats.Option) (*JetStreamPublisher, error) {
	if url == "" {
		return nil, errors.New("nats url không được rỗng")
	}
	nc, err := nats.Connect(url, opts...)
	if err != nil {
		return nil, fmt.Errorf("kết nối NATS %q: %w", url, err)
	}
	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("khởi tạo JetStream: %w", err)
	}
	return &JetStreamPublisher{nc: nc, js: js}, nil
}

// NewJetStreamPublisherFromConn dựng publisher từ NATS Conn đã có.
func NewJetStreamPublisherFromConn(nc *nats.Conn) (*JetStreamPublisher, error) {
	if nc == nil {
		return nil, errors.New("nats connection không được nil")
	}
	js, err := nc.JetStream()
	if err != nil {
		return nil, fmt.Errorf("khởi tạo JetStream: %w", err)
	}
	return &JetStreamPublisher{nc: nc, js: js}, nil
}

// Publish phát phong bì CloudEvents lên subject bằng với `env.Type`.
func (p *JetStreamPublisher) Publish(ctx context.Context, env Envelope) error {
	return p.PublishToSubject(ctx, env.Type, env)
}

// PublishToSubject phát phong bì lên một subject cụ thể (vd: "DLQ." + env.Type).
// Gắn nats.MsgId(env.ID) để JetStream tự loại trùng lặp trong cửa sổ dupe-window 2 phút (ADR-0003).
func (p *JetStreamPublisher) PublishToSubject(ctx context.Context, subject string, env Envelope) error {
	raw, err := json.Marshal(env)
	if err != nil {
		return fmt.Errorf("mã hoá envelope: %w", err)
	}
	msg := &nats.Msg{
		Subject: subject,
		Data:    raw,
		Header:  make(nats.Header),
	}
	msg.Header.Set(nats.MsgIdHdr, env.ID)
	if env.TraceParent != "" {
		msg.Header.Set("traceparent", env.TraceParent)
	}

	_, err = p.js.PublishMsg(msg, nats.Context(ctx))
	if err != nil {
		return fmt.Errorf("publish sự kiện %s sang %s (%s): %w", env.Type, subject, env.ID, err)
	}
	return nil
}

// Close đóng kết nối NATS.
func (p *JetStreamPublisher) Close() error {
	if p.nc != nil {
		p.nc.Close()
	}
	return nil
}

// PublishedMessage đại diện cho một tin nhắn đã phát kèm subject.
type PublishedMessage struct {
	Subject  string
	Envelope Envelope
}

// InMemoryPublisher lưu sự kiện trong bộ nhớ — phục vụ kiểm thử đơn vị hoặc mock.
type InMemoryPublisher struct {
	mu        sync.RWMutex
	messages  []PublishedMessage
	failNext  error
	published chan PublishedMessage
}

// NewInMemoryPublisher tạo publisher bộ nhớ với kênh đệm tuỳ chọn để lắng nghe sự kiện.
func NewInMemoryPublisher(bufSize int) *InMemoryPublisher {
	var ch chan PublishedMessage
	if bufSize > 0 {
		ch = make(chan PublishedMessage, bufSize)
	}
	return &InMemoryPublisher{
		messages:  make([]PublishedMessage, 0),
		published: ch,
	}
}

// Publish phát phong bì lên subject env.Type.
func (m *InMemoryPublisher) Publish(ctx context.Context, env Envelope) error {
	return m.PublishToSubject(ctx, env.Type, env)
}

// PublishToSubject ghi nhận sự kiện vào danh sách trong bộ nhớ cùng subject chỉ định.
func (m *InMemoryPublisher) PublishToSubject(_ context.Context, subject string, env Envelope) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.failNext != nil {
		err := m.failNext
		m.failNext = nil
		return err
	}
	msg := PublishedMessage{Subject: subject, Envelope: env}
	m.messages = append(m.messages, msg)
	if m.published != nil {
		select {
		case m.published <- msg:
		default:
		}
	}
	return nil
}

// SetFailNext thiết lập lỗi giả lập cho lần publish tiếp theo.
func (m *InMemoryPublisher) SetFailNext(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.failNext = err
}

// Messages trả bản sao các tin nhắn đã publish.
func (m *InMemoryPublisher) Messages() []PublishedMessage {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]PublishedMessage, len(m.messages))
	copy(out, m.messages)
	return out
}

// Events trả bản sao các Envelope đã publish (bỏ qua subject).
func (m *InMemoryPublisher) Events() []Envelope {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Envelope, len(m.messages))
	for i, msg := range m.messages {
		out[i] = msg.Envelope
	}
	return out
}

// PublishedChan trả kênh nhận tin nhắn mới.
func (m *InMemoryPublisher) PublishedChan() <-chan PublishedMessage {
	return m.published
}

// Count đếm số sự kiện đã phát.
func (m *InMemoryPublisher) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.messages)
}

// Reset xoá sạch tin nhắn đã lưu.
func (m *InMemoryPublisher) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.messages = m.messages[:0]
}

// Close kết thúc InMemoryPublisher.
func (m *InMemoryPublisher) Close() error {
	return nil
}

// Verify interfaces
var (
	_ Publisher = (*JetStreamPublisher)(nil)
	_ Publisher = (*InMemoryPublisher)(nil)
)

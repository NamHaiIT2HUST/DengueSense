from experiments.exp_018_rag_retrieval.encoder_smoke import stop_reason


def test_smoke_stops_on_resource_envelope():
    assert stop_reason(8 * 1024**3 + 1, [1], [100]) == "RSS_LIMIT"
    assert stop_reason(1, [2, 2, 2], [100]) == "MEMORY_PRESSURE"
    assert stop_reason(1, [1], [100, 101, 102, 103]) == "SWAP_RISING"
    assert stop_reason(1, [1, 2, 1], [100, 101, 101, 102]) is None

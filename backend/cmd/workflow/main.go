package main

import (
	"fmt"
	"net/http"
)

func main() {
	fmt.Println("Starting workflow service...")
	// TODO: Init Gin router and register handlers from api.gen.go
	// TODO: Init NATS JetStream consumer for forecast.run.completed
	http.ListenAndServe(":8001", nil)
}

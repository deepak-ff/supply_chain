package main

import (
	"fmt"
	"os"

	"github.com/deepak-ff/supply_chain/internal/api/server"
)

func main() {
	cfg := server.LoadConfig()
	if err := server.Run(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
		os.Exit(1)
	}
}

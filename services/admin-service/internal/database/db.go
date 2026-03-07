package database

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool is the global database connection pool.
var Pool *pgxpool.Pool

// Connect establishes a PostgreSQL connection pool.
func Connect(databaseURL string) {
	var err error
	Pool, err = pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}

	// Verify connection
	if err = Pool.Ping(context.Background()); err != nil {
		log.Fatalf("Unable to ping database: %v", err)
	}

	log.Println("✓ Database connected")
}

// Close gracefully closes the connection pool.
func Close() {
	if Pool != nil {
		Pool.Close()
	}
}

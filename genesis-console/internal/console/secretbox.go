package console

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strings"
)

// Saved cluster credentials are encrypted with a key kept outside the
// database, so a database backup alone cannot reveal them.

func LoadConnectionKey() ([]byte, error) {
	text := os.Getenv("GENESIS_CONNECTION_KEY")
	if file := os.Getenv("GENESIS_CONNECTION_KEY_FILE"); file != "" {
		raw, err := os.ReadFile(file)
		if err != nil {
			return nil, fmt.Errorf("read connection key: %w", err)
		}
		text = string(raw)
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, nil
	}
	key, err := base64.StdEncoding.DecodeString(text)
	if err != nil || len(key) != 32 {
		return nil, errors.New("the connection key must be 32 random bytes in base64 (openssl rand -base64 32)")
	}
	return key, nil
}

func gcm(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func seal(key, plaintext, associated []byte) ([]byte, error) {
	aead, err := gcm(key)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return aead.Seal(nonce, nonce, plaintext, associated), nil
}

func open(key, sealed, associated []byte) ([]byte, error) {
	aead, err := gcm(key)
	if err != nil {
		return nil, err
	}
	if len(sealed) < aead.NonceSize() {
		return nil, errors.New("sealed value is too short")
	}
	return aead.Open(nil, sealed[:aead.NonceSize()], sealed[aead.NonceSize():], associated)
}

package email

import (
	"fmt"
	"log"
	"net/smtp"
	"strings"
)

// Sender handles sending emails via SMTP.
type Sender struct {
	Host string
	Port string
	User string
	Pass string
	From string
}

// NewSender creates a new email sender.
func NewSender(host, port, user, pass, from string) *Sender {
	return &Sender{
		Host: host,
		Port: port,
		User: user,
		Pass: pass,
		From: from,
	}
}

// SendResetCode sends a password reset verification code to the user.
func (s *Sender) SendResetCode(to, code string) error {
	subject := "Password Reset Code - Kshiti Execution Platform"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Kshiti</h1>
    <p style="color: #6b7280; font-size: 14px;">Execution Platform</p>
  </div>
  <div style="background: #f8f9fb; border-radius: 12px; padding: 32px; text-align: center;">
    <p style="color: #374151; font-size: 16px; margin-bottom: 8px;">Your verification code is:</p>
    <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #7c5cff; margin: 16px 0;">%s</div>
    <p style="color: #6b7280; font-size: 13px;">This code expires in 15 minutes.</p>
  </div>
  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
    If you didn't request this, please ignore this email.
  </p>
</body>
</html>`, code)

	mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n%s\r\n%s",
		s.From, to, subject, mime, body)

	// If SMTP credentials are not configured, log the code instead
	if s.Host == "" || s.User == "" {
		log.Printf("📧 [DEV MODE] Reset code for %s: %s", to, code)
		return nil
	}

	addr := s.Host + ":" + s.Port
	auth := smtp.PlainAuth("", s.User, s.Pass, s.Host)

	err := smtp.SendMail(addr, auth, s.From, strings.Split(to, ","), []byte(msg))
	if err != nil {
		log.Printf("Email send error: %v", err)
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("📧 Reset code sent to %s", to)
	return nil
}

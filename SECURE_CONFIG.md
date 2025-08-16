# Secure Page Configuration

## Environment Variables

Add the following environment variable to your deployment:

```
NEXT_PUBLIC_SECURE_PASSWORD=SecurePulse2025!
```

## Default Password

If no environment variable is set, the default password is: `SecurePulse2025!`

## Security Features

- **Rate limiting**: 3 failed attempts before 5-minute lockout
- **Local storage tracking**: Attempts and lockout times are stored locally
- **Password masking**: Option to show/hide password input
- **Copy functionality**: One-click SSN copying
- **Auto-lockout**: Automatic session timeout after failed attempts

## Accessing the Page

The secure page is available at: `https://fitwithpulse.ai/secure`

## SSN Information

The page displays: `999-999-9999`

## Security Notes

- This is a client-side implementation suitable for personal use
- For production environments with sensitive data, consider server-side authentication
- The page includes security warnings and best practices for users
- Lockout state persists across browser sessions until timeout expires

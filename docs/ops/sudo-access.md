# Sudo Access Findings – 2026-02-15

- Automation user: `noraclawdbot` (uid 501) is already in the `admin` group.
- Shell environment: non-interactive (no TTY) — `tty`/`ps -p $$ -o tty=` both report `not a tty`.
- `sudo whoami` / `sudo -l` fail immediately with: `sudo: a terminal is required to read the password; either use the -S option to read from standard input or configure an askpass helper`.
- No `SUDO_ASKPASS` helper is configured (`env | grep -i ask` empty) and `/etc/sudoers` cannot be read without sudo.

## Next Step for Admins
- Configure passwordless sudo for the automation user (preferred) **OR**
- Provide a `SUDO_ASKPASS` helper + credentials that the automation shell can call.

Until one of those is in place, any `sudo …` command will continue to fail because the sandbox cannot present a TTY or interactive prompt.

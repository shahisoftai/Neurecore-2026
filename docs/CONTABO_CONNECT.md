# Quick Contabo SSH connection

This helper lets you connect to your Contabo host quickly using the password stored at `/root/contabo`.

Script: `scripts/connect_contabo.sh`

Defaults:

- Host: `109.123.248.253`
- User: `admin`
- Password file: `/root/contabo`
- Port: `22`

Usage examples:

```bash
# interactive invocation with defaults
sudo bash scripts/connect_contabo.sh

# specify host/user/path/port
sudo bash scripts/connect_contabo.sh 109.123.248.253 admin /root/contabo 22
```

Requirements:

- `sshpass` (recommended): the script uses `sshpass -f /root/contabo` when available.
- otherwise `expect` (fallback) must be installed to supply the password.

Install helpers (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install -y sshpass expect
```

Security notes:

- Keep `/root/contabo` owned by `root` with mode `600` so only root can read it.
- Do NOT commit the password file to git — it's outside the repository by default.
- Prefer SSH key authentication or a secret manager for production use.

# Secret storage: admin password

This repository includes small helper scripts to store and read an `admin` password on the host outside the repository. These scripts are intentionally simple — they do not transmit secrets anywhere and are meant for local use on the machine you control.

Files added:

- `scripts/store_admin_password.sh` — store a password to an absolute path (default `/root/.admin_password`) with secure permissions (owner `root`, mode `600`).
- `scripts/get_admin_password.sh` — read the password file (prints to stdout).

Security notes and recommended usage:

- Do NOT commit the password file into git. The default location (`/root/.admin_password`) is outside the repo, so it will not be tracked by git by default.
- Prefer SSH keys or a proper secrets manager (Vault, AWS Secrets Manager, GCP Secret Manager, etc.) for production systems.
- Only run the `store` script as root (it will refuse otherwise). Example (interactive):

```bash
sudo bash scripts/store_admin_password.sh /root/.admin_password
```

Or pipe the secret non-interactively (avoid shell history):

```bash
echo -n "my-secret-password" | sudo bash scripts/store_admin_password.sh /root/.admin_password
```

- To read the secret (careful — this prints the password):

```bash
sudo bash scripts/get_admin_password.sh /root/.admin_password
```

- If you want an application in the repo to read the secret, have it accept the absolute path via an environment variable, for example `ADMIN_PASS_FILE=/root/.admin_password`.

Preventing accidental commits

- If you have a local file inside the repo that you want ignored, add it to `.gitignore`. Example entry:

```
# local secret examples
secret-files/
```

- For secrets that must live in the repo for some reason, use an encryption tool (`git-crypt`, `sops`) or a proper secret management service.

Why this approach

- Storing a secret as an absolute file owned by root with `600` permissions limits accidental exposure on the host.
- The scripts here are minimal helpers — they do not try to circumvent repository tooling or remote protections. Use them only on machines you control and pair with your organizational policies.

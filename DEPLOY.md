# Deploying Guild of the Open Mic

This guide takes the project from your PC to a small server on the internet, so your friends can open a normal URL and see the shared world. The game is a single lightweight Node process, so the cheapest tier of any VPS provider is more than enough.

What you will end up with: one always-on Linux machine running the game server as a background service, Caddy in front of it providing HTTPS, a domain name pointing at it, and the Discord bot and login working against your real community. Total cost is roughly 5 dollars a month for the VPS plus a domain if you do not already have one.

## 1. Get a server and a domain

Rent the smallest VPS from a provider such as Hetzner, DigitalOcean, Vultr, or Railway; pick Ubuntu 24.04 as the operating system. 1 vCPU and 1 GB of RAM is plenty. Note the server's public IP address.

Point a domain (or a subdomain like `guild.yourdomain.com`) at that IP with an A record at your DNS provider. HTTPS is not optional in practice: browsers restrict things on plain HTTP, and Discord OAuth redirects should be secure. Caddy will handle the certificates automatically once the domain resolves.

## 2. Install Node and Caddy on the server

SSH in as root (or a sudo user) and install Node 20 and Caddy:

```
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs build-essential
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy
```

`build-essential` is there so better-sqlite3 can compile itself if a prebuilt binary is not available for your platform.

Create a dedicated user for the game so it does not run as root:

```
useradd -r -m -d /opt/guild -s /usr/sbin/nologin guild
```

## 3. Put the project on the server and build it

Copy the project up (from your PC: `scp -r guild-mp root@YOUR_IP:/opt/guild/app`, or push it to a git repository and clone it there). Then install and build:

```
cd /opt/guild/app/server && npm install
cd /opt/guild/app/client && npm install && npm run build
chown -R guild:guild /opt/guild
```

The build step matters: in production the game server itself serves the built page from `client/dist`, so the whole game lives on one port behind one domain. You will not run `npm run dev` on the server at all.

## 4. Configure the game

Create `/opt/guild/app/server/.env`:

```
DISCORD_TOKEN=your-bot-token
VOICE_CHANNEL_ID=your-voice-channel-id
ANNOUNCE_CHANNEL_ID=optional-text-channel-id
DISCORD_CLIENT_ID=your-application-client-id
DISCORD_CLIENT_SECRET=your-application-client-secret
OAUTH_REDIRECT_URI=https://guild.yourdomain.com/auth/callback
CLIENT_URL=https://guild.yourdomain.com
```

Then update the Discord developer portal to match: in your application under OAuth2, add `https://guild.yourdomain.com/auth/callback` as a redirect. The bot token and channel IDs are the same ones from the README's bot section. Keep this file readable only by the game user: `chmod 600 /opt/guild/app/server/.env && chown guild:guild /opt/guild/app/server/.env`.

## 5. Run it as a service

Copy the provided unit file and enable it:

```
cp /opt/guild/app/deploy/guild.service /etc/systemd/system/guild.service
systemctl daemon-reload
systemctl enable --now guild
systemctl status guild
```

The status output should show the world loading and both the bot and OAuth coming online. From now on the game starts on boot, restarts if it ever crashes, and its logs are available with `journalctl -u guild -f`.

## 6. Put Caddy in front for HTTPS

Copy the provided Caddyfile, edit the domain, and reload:

```
cp /opt/guild/app/deploy/Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile   # replace guild.example.com with your domain
systemctl reload caddy
```

Caddy fetches a certificate automatically and proxies everything, including the WebSocket, to the game on port 8787. If your VPS has a firewall, allow ports 80 and 443 and keep 8787 closed to the outside; only Caddy needs to reach it:

```
ufw allow 80,443/tcp && ufw enable
```

## 7. Try it

Open `https://guild.yourdomain.com` in a browser. You should see the world (probably asleep). Join the Discord voice channel and your adventurer walks in on every open browser at once. Click Log in with Discord and your name and avatar appear in the header, unlocking your own character's wardrobe.

## Day-two operations

Updating: copy the new code up, rebuild the client, restart the service:

```
cd /opt/guild/app/client && npm run build
systemctl restart guild
```

A restart mid-session is safe: the world saves on shutdown, and anyone in voice is synced back in when the bot reconnects.

Backups: the entire game state is the single file `/opt/guild/app/server/guild.db`. Copy it anywhere on a schedule and you can never lose the campaign; a nightly cron line such as `cp /opt/guild/app/server/guild.db /opt/guild/backups/guild-$(date +%F).db` is already respectable.

Troubleshooting: `journalctl -u guild -f` shows the game log. "Discord login failed" at boot means the bot token is wrong. "Invalid OAuth state" or a failed login usually means the redirect URL in the Discord portal does not exactly match OAUTH_REDIRECT_URI. If the page loads but stays on CONNECTING, Caddy is likely not proxying to 8787 or the service is not running.

## The dev sidebar in production

The simulated voice panel still exists in the deployed client, but with OAuth on it requires a logged-in user to do anything, and it can never touch real Discord players. If you would rather hide it entirely for your community, that is a small UI change; the server-side rules already make it harmless.

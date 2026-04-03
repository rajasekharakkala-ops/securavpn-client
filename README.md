# SecuraVPN Nexus: Premium Linux Desktop Suite

![Nexus Banner](https://raw.githubusercontent.com/rajasekharakkala-ops/securavpn-client/main/docs/banner.png)

## 🛰️ Overview
**SecuraVPN Nexus** is a state-of-the-art, high-performance VPN client built for the Linux ecosystem. It leverages a **Hybrid Architecture** combining the battle-tested security of the OpenVPN C++ core with a premium, high-fidelity React dashboard.

### 💎 Key Features
*   **🌍 Nexus Global Grid**: Futuristic dot-matrix world map for intuitive server node selection.
*   **⚡ Efficiency Engine**: Near-zero idle CPU and RAM usage through intelligent stats-polling suspension.
*   **🛡️ Encrypted Vault**: Industry-standard **Safe Storage** using the native OS keychain (libsecret/Keychain).
*   **🐧 Native Integration**: System tray controls, state-aware notifications, and precise PID-based process management.
*   **🚀 Handshake Awareness**: Real-time handshake verification to ensure your tunnel is always secured.

## 📦 Installation (Linux / Debian)
To install the latest stable build on your distribution (Ubuntu, Debian, Mint, etc.):

```bash
# Download the .deb from the Releases page
sudo dpkg -i securavpnclient_1.0.2_amd64.deb
sudo apt-get install -f # Fix any missing dependencies
```

## 🛠️ Development & Build
Built with **Electron**, **React**, and **Vite**.

```bash
npm install
npm run dev   # Start development server
npm run dist  # Build production .deb installer
```

## 🛡️ Security
SecuraVPN Nexus is designed with a **Security-First** mindset:
*   **Context Isolation**: Renderer processes cannot directly access the filesystem.
*   **Process Sandboxing**: The VPN core is isolated from the UI logic.
*   **Native Bridge**: All system calls are handled through a secure, pre-cleared IPC bridge.

---

**© 2026 SecuraVPN. All rights reserved. Nexus is a trademark of SecuraVPN.**

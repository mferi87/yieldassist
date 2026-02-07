#!/bin/bash
# Installation script for YieldAssist Bridge
# Installs to user's home folder with a virtual environment

set -e

INSTALL_DIR="$HOME/yieldassist-bridge"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing YieldAssist Bridge to $INSTALL_DIR..."

# Check for python3-venv
if ! python3 -c "import ensurepip" 2>/dev/null; then
    echo ""
    echo "❌ Error: python3-venv is not installed."
    echo ""
    echo "Please install it first:"
    echo "  sudo apt install python3-venv"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Create install directory
mkdir -p "$INSTALL_DIR"

# Copy files
cp "$SCRIPT_DIR/bridge.py" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/"

# Copy config if not exists
if [ ! -f "$INSTALL_DIR/config.yaml" ]; then
    cp "$SCRIPT_DIR/config.example.yaml" "$INSTALL_DIR/config.yaml"
    echo "Created config.yaml - please edit with your settings"
fi

# Create virtual environment
echo "Creating Python virtual environment..."
python3 -m venv "$INSTALL_DIR/venv"

# Install dependencies
echo "Installing Python dependencies..."
"$INSTALL_DIR/venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/requirements.txt"

# Create run script
cat > "$INSTALL_DIR/run.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./venv/bin/python bridge.py
EOF
chmod +x "$INSTALL_DIR/run.sh"

# Create user systemd service directory
mkdir -p "$HOME/.config/systemd/user"

# Create user systemd service
cat > "$HOME/.config/systemd/user/yieldassist-bridge.service" << EOF
[Unit]
Description=YieldAssist SMHUB Bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/bridge.py
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF

echo ""
echo "✅ Installation complete!"
echo ""
echo "📁 Installed to: $INSTALL_DIR"
echo ""
echo "Next steps:"
echo "1. Edit config: nano $INSTALL_DIR/config.yaml"
echo "2. Test run: $INSTALL_DIR/run.sh"
echo ""
echo "To run as a service (auto-start on login):"
echo "  systemctl --user daemon-reload"
echo "  systemctl --user enable yieldassist-bridge"
echo "  systemctl --user start yieldassist-bridge"
echo "  systemctl --user status yieldassist-bridge"
echo ""
echo "To run at boot (even without login):"
echo "  sudo loginctl enable-linger $USER"
echo ""
echo "View logs:"
echo "  journalctl --user -u yieldassist-bridge -f"

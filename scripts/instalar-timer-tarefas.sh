#!/usr/bin/env bash
# Liga o timer que sincroniza as tarefas com a planilha a cada 10 min (e 2 min depois que o PC liga).
# Grava as unidades em ~/.config/systemd/user, com o caminho do node de agora (o do nvm muda de versão: se trocar,
# rode de novo). Pra desligar: systemctl --user disable --now tarefas-sincronizar.timer
set -euo pipefail
NODE="$(command -v node)"
PASTA="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="$HOME/.config/systemd/user"
mkdir -p "$DESTINO"

cat > "$DESTINO/tarefas-sincronizar.service" <<UNIT
[Unit]
Description=Tarefas: lista do PC <-> planilha Tarefas (task-tracker)
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$PASTA
ExecStart=$NODE $PASTA/local/tarefas/sincronizar.cjs
UNIT

cat > "$DESTINO/tarefas-sincronizar.timer" <<UNIT
[Unit]
Description=Tarefas: sincroniza a cada 10 min

[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now tarefas-sincronizar.timer
systemctl --user list-timers tarefas-sincronizar.timer --no-pager

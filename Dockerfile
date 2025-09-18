FROM node:18

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    git build-essential make gcc g++ \
    openssh-server vim curl wget net-tools procps \
    postgresql-client \
    php-fpm php-pgsql php-json php-curl \
    nginx \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Configure SSH
RUN mkdir /var/run/sshd && \
    sed -i 's/#Port 22/Port 22/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config

# Create aspuser
RUN useradd -ms /bin/bash aspuser && \
    echo 'aspuser:aspuser' | chpasswd && \
    usermod -aG sudo aspuser

# Install Python packages globally
RUN pip3 install --break-system-packages \
    flask flask-cors \
    pytest psycopg2-binary \
    requests python-dotenv \
    pandas numpy

# Set working directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/logs /app/data /app/temp && \
    chown -R aspuser:aspuser /app

# Copy startup script
COPY --chown=aspuser:aspuser startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# Switch to aspuser
USER aspuser

# Set environment variables
ENV NODE_ENV=development \
    CI=false \
    PATH="/home/aspuser/.local/bin:${PATH}"

# Expose ports
EXPOSE 22 3000 8000 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010 3011 3012 3013 3014 3015 3016 3017 3018 3019 3020 3021 3022

# Start services
USER root
CMD ["/app/startup.sh"]
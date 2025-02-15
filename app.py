from flask import Flask, render_template, request, redirect, url_for, flash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
import os
import subprocess
import json
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.urandom(24)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

class User(UserMixin):
    def __init__(self, id, username, password_hash):
        self.id = id
        self.username = username
        self.password_hash = password_hash

# Store users in memory (you might want to use a database in production)
users = {}

def init_admin_user(password):
    admin_user = User(1, 'admin', generate_password_hash(password))
    users[1] = admin_user

@login_manager.user_loader
def load_user(user_id):
    return users.get(int(user_id))

@app.route('/')
@login_required
def index():
    server_status = get_server_status()
    return render_template('index.html', server_status=server_status)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        user = next((u for u in users.values() if u.username == username), None)
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for('index'))
        
        flash('Invalid username or password')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/start_server')
@login_required
def start_server():
    subprocess.Popen(['bash', '/opt/mcserver/minecraft/start.sh'])
    flash('Server starting...')
    return redirect(url_for('index'))

@app.route('/stop_server')
@login_required
def stop_server():
    # Implement graceful server shutdown
    subprocess.run(['pkill', '-f', 'server.jar'])
    flash('Server stopping...')
    return redirect(url_for('index'))

def get_server_status():
    try:
        output = subprocess.check_output(['pgrep', '-f', 'server.jar'])
        return 'Running'
    except subprocess.CalledProcessError:
        return 'Stopped'

if __name__ == '__main__':
    # Read password from setup script
    with open('/tmp/mc_admin_pass.txt', 'r') as f:
        admin_password = f.read().strip()
    init_admin_user(admin_password)
    app.run(host='0.0.0.0', port=80) 
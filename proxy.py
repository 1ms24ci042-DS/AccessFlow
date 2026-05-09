import socket
import threading

def forward(source, destination):
    while True:
        try:
            data = source.recv(4096)
            if not data: break
            destination.sendall(data)
        except Exception:
            break
    source.close()
    destination.close()

def handle_client(client_socket):
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        server_socket.connect(('127.0.0.1', 11434))
        threading.Thread(target=forward, args=(client_socket, server_socket)).start()
        threading.Thread(target=forward, args=(server_socket, client_socket)).start()
    except Exception:
        client_socket.close()

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(('0.0.0.0', 11435))
server.listen(5)
print('Proxy listening on 0.0.0.0:11435 -> 127.0.0.1:11434')
while True:
    client, addr = server.accept()
    threading.Thread(target=handle_client, args=(client,)).start()

const { Server } = require("net");

const host = "localhost";

const END = "END";
const request = "1";
const FINISH_CHAT = "FINISH CHAT";

const connections = new Map(); //Mapa que almacenará todos los usuarios que lleguen
const onHold = []; //Array que tendrá las conexiones que estén en estado de espera (si el usuario al que se le pregunta acepta o declina)
const chats = new Map();

function main() {
  if (process.argv.length !== 3) {
    error(`Usage: node ${__filename} port`);
  }
  let port = process.argv[2];
  if (isNaN(port)) {
    error(`Invalid port ${port}`);
    process.exit(1);
  }

  port = Number(port);

  listen(port);
}

function listen(port) {
  const server = new Server();

  server.listen({ host, port }, () => {
    console.log(`Listening on port: ${port}`);
  });

  server.on("connection", (socket) => {
    const remoteSocket = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`New connection from ${remoteSocket}`);
    socket.setEncoding("utf-8");

    socket.on("data", (message) => {
      if (chats.has(socket)) {
        manageChat(socket, message);
      } else if (message.toUpperCase() === END) {
        console.log(`Connection finalized with ${remoteSocket}`);
        connections.delete(socket);
        socket.end();
        updateUsersWithoutConection();
      } else if (!connections.has(socket)) {
        validateNotRepeatUsername(socket, message);
      } else if (onHold.includes(socket)) {
        validateConnectionAnswer(message, socket);
      } else if (!chats.has(socket)) {
        makeConnection(socket, message);
      }
    });
  });
}

function validateNotRepeatUsername(socket, message) {
  const names = Array.from(connections.values());
  const userName = message;
  if (!names.includes(userName)) {
    connections.set(socket, userName);
    showConnectedUsers(socket);
    updateConnectedUsers(socket);
  } else {
    socket.write("ERROR! This username is already used \n Try again!\n");
  }
}

//Cuando entra otra persona, debo poder decirle que hay conectados pero también están ocupados.
function showConnectedUsers(socket) {
  if (connections.size > 1) {
    socket.write("Users connected: \n");
    const values = Array.from(connections.values());
    const keys = Array.from(connections.keys());
    const onChat = Array.from(chats.keys());

    for (var i = 0; i < values.length; i++) {
      if (onChat.includes(keys[i])) {
        socket.write(`-.${values[i]} - [occupied]\n`);
      } else if (keys[i] !== socket) {
        socket.write(`-.${values[i]} \n`);
      }
    }
  } else {
    socket.write("You are the first here! \n");
  }
}

function updateConnectedUsers(firstSocket) {
  const values = Array.from(connections.values());
  const keys = Array.from(connections.keys());
  for (const auxSocket of connections.keys()) {
    if (!(auxSocket === firstSocket) && !chats.has(auxSocket) && !onHold.includes(auxSocket)) {
      auxSocket.write("--------------------- \n");
      for (var i = 0; i < values.length; i++) {
        if (!(keys[i] === auxSocket)) {
          if (chats.has(keys[i])) {
            auxSocket.write(`-.${values[i]} - [occupied] \n`);
          } else {
            auxSocket.write(`-.${values[i]} \n`);
          }
        }
      }
    }
  }
}

function updateUsersWithoutConection() {
  const values = Array.from(connections.entries());
  const onChat = Array.from(chats.keys());
  if (values.length > 1) {
    for (const auxSocket of connections.keys()) {
      if (!onChat.includes(auxSocket) && !onHold.includes(auxSocket)) {
        for (var i = 0; i < values.length; i++) {
          if (chats.has(values[i][0])) {
            auxSocket.write(`-.${values[i][1]} - [occupied] \n`);
          } else if (values[i][0] !== auxSocket) {
            auxSocket.write(`-.${values[i][1]} \n`);
          }
        }
      }
    }
  } else {
    values[0][0].write("You are the only one here");
  }
}

function makeConnection(socket, message) {
  const values = Array.from(connections.entries());
  const onlyValues = Array.from(connections.values());
  let isFound = false;
  if (onlyValues.includes(message)) {
    for (var i = 0; i < values.length && !isFound; i++) {
      if (!chats.has(values[i][0])) {
        if (
          values[i][1] === message &&
          values[i][0] !== socket &&
          !onHold.includes(values[i][0])
        ) {

          values[i][0].write(`${request}${connections.get(socket)}`);
          onHold.push(socket);
          onHold.push(values[i][0]);
          isFound = true;
        } else if (values[i][1] === message && onHold.includes(values[i][0])) {
          socket.write("ERROR! This user is on hold");
          isFound = true;
        } else if (values[i][1] === message) {
          socket.write("ERROR! It's your username");
          isFound = true;
        }
      } else if (values[i][1] === message) {
        isFound = true;
        socket.write("ERROR! This user is already connect!");
      }
    }
  } else {
    socket.write("ERROR! This user doesn't exist!");
  }
}

// Aquí voy a buscar el socket y el anterior
function validateConnectionAnswer(message, socket) {
  let position = 0;
  for (var i = 0; i < onHold.length; i++) {
    if (onHold[i] === socket) {
      position = i;
    }
  }
  if (message === "ACCEPT") {
    chats.set(onHold[position], onHold[position - 1]);
    chats.set(onHold[position - 1], onHold[position]);
    onHold[position].write("Connection Accepted.");
    onHold[position - 1].write("The other person accepted. Enjoy.");
    onHold[position] = null;
    onHold[position - 1] = null;
    updateUsersWithoutConection();
  } else if (message === "DECLINE") {
    onHold[position].write("Connection denied.");
    onHold[position - 1].write(
      "The other person don't accept your connection."
    );
    onHold[position] = null;
    onHold[position - 1] = null;
    updateUsersWithoutConection();
  } else {
    socket.write("ERROR! This isn't an option");
  }
}

function manageChat(socket, message) {
  const auxSocket = chats.get(socket);
  const userName = connections.get(socket);

  if (message.toUpperCase() === FINISH_CHAT) {
    const auxUserName = connections.get(auxSocket);
    finaliceChat(socket, auxSocket);
    socket.write(
      `Your chat with ${auxUserName} is over. Connect with another user.`
    );
    auxSocket.write(
      `Your chat with ${userName} is over. Connect with another user.`
    );
    showConnectedUsers(socket);
    showConnectedUsers(auxSocket);
    updateConnectedUsers(socket);
    updateConnectedUsers(auxSocket);
  } else {
    auxSocket.write(`${userName}: ${message}`);
  }
}

function finaliceChat(firstSocket, secondSocket) {
  chats.delete(firstSocket);
  chats.delete(secondSocket);
}

function error(message) {
  console.log(message);
  process.exit(1);
}

if (require.main === module) {
  main();
}

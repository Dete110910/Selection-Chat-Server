const { Socket } = require("net");
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

//Es necesaria para el principio de la conexión, cuando el servidor rebote con el nombre de usuario y que no lo imprima con este formato
const request = '1';

function main() {
  if (process.argv.length !== 4) {
    error(`Usage: node ${__filename} host port`);
  }

  let [, , host, port] = process.argv;

  if (isNaN(port)) {
    console.log(`Invalid port ${port}`);
  }

  port = Number(port);

  connect(host, port);
}

function connect(host, port) {
  console.log(`Connecting to ${host}:${port}`);
  const socket = new Socket();

  socket.connect({ host, port });
  socket.setEncoding("utf-8");

  socket.on("connect", () => {
    console.log("Connected");

    readline.question("Choose your username: ", (username) => {
      socket.write(username);
      console.log("Usage: Use \"END\" to exit or type the name of another user to chat.")
    });

    readline.on("line", (message) => {
      socket.write(message);
    })

    socket.on("data", (message) => {
      if(message.charAt(0) === request){ //En caso de que el mensaje venga con ese prefijo, se sabrá que es una petición de conexión, en este caso
        message = message.substring(1); // de lo contrario lo imprimirá
        readline.question(`The user ${message} wanna connect with u \nWrite ACCEPT to acept or DECLINE to decline \n`, (confirmation) => {
        socket.write(`${confirmation}`);
        })
      }else{
        console.log(message);

      }
    })

    socket.on("error", (err) => error(err.message));

    socket.on("close", () => {
      console.log("Disconnected");
      process.exit(0);
    })

  });

}

function error(message) {
  console.log(message);
  process.exit(1);
}

if (module === require.main) {
  main();
}

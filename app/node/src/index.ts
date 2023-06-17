import { app } from "./app";

// const port = 8000;
// app.listen(port, () => {
//   console.log(`ポート${port}番で起動しました。`);
// });

const ports = [8000, 8001];
ports.forEach(port => {
  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
});

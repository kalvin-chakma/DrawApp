import express from "express";

const app = express();
app.listen(4000, () => {
    console.log("HTTP server is listening on port 4000");
});
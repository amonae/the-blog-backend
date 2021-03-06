const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("./config/db");

const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const mongoose = require("mongoose");
connectDB();
mongoose.set("returnOriginal", false);

const User = require("./models/User");
const bcrypt = require("bcrypt");

const typeDefs = require("./schema/schema");
const resolvers = require("./resolvers/index");
const { graphqlHTTP } = require("express-graphql");

const { makeExecutableSchema } = require("graphql-tools");

const app = express();

app.use(
  cors({
    origin: "https://www.writeon.ink",
    credentials: true,
  })
);

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// app.use(express.static(path.join(__dirname, "build")));

// app.get("/*", function (req, res) {
//   res.sendFile(path.join(__dirname, "build", "index.html"));
// });

app.post("/login", (req, res, next) => {
  let username = req.body.username.trim();
  let password = req.body.password.trim();

  User.findOne({ username: username }, async (err, user) => {
    try {
      if (err) {
        throw new Error(err);
      }

      if (!user) {
        res.redirect("https://www.writeon.ink/login");
        throw new Error(`There is no user with that username.`);
      }

      if (
        !(
          password === user.password ||
          (await bcrypt.compare(password, user.password))
        )
      ) {
        res.redirect("https://www.writeon.ink/login");
        throw `Incorrect password!`;
      } else {
        let privateKey = process.env.SECRET_JWT_KEY;
        let token = jwt.sign(
          { username: user._doc.username, _id: user._doc._id },
          privateKey
        );
        res.cookie("jwt", token, { httpOnly: true });
        res.redirect("https://www.writeon.ink");
      }
    } catch (err) {
      return err;
    }
  });
});

app.get("/logout", (req, res, next) => {
  try {
    if (req.cookies.jwt) {
      res.clearCookie("jwt", {
        domain: "https://www.writeon.ink",
        path: "/",
        httpOnly: true,
      });
      res.sendStatus(200);
    } else {
      throw new Error("There is no logged in user!");
    }
  } catch (err) {
    throw err;
  }
});

app.get("/current", function (req, res) {
  let token = req.cookies.jwt;
  if (!token) {
    return res.json(false);
  } else {
    let payload = jwt.verify(token, process.env.SECRET_JWT_KEY);
    return res.json(payload);
  }
});

app.use("/graphql", (req, res, next) => {
  try {
    let token = req.cookies.jwt;
    if (!token) {
      throw new Error("No user is logged in.");
    } else {
      let payload = jwt.verify(token, process.env.SECRET_JWT_KEY);
      let { username, _id } = payload;
      req.user = { username, _id };
      next();
    }
  } catch (err) {
    throw err;
  }
});

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    graphiql: true,
  })
);

app.listen(process.env.PORT, () =>
  console.log(`Listening on port ${process.env.PORT}`.cyan)
);

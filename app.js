//  - - - - - - - - -D E P E N D A N C E S- - - - - - - - - - //
//                          M A I N                             //

// express & express-session
const express = require("express");

const session = require("express-session");
const http = require("http");
const app = express();
const server = http.createServer(app);


// Configurer express-session
app.use(
  session({
    key: "userId",
    secret: "1234",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30*24 * 60 * 60 * 1000, 
    },
  })
);

// CORS :
const cors = require("cors");
app.use(cors({ 
  origin: 'http://localhost:3000', 
  methods: 'GET, POST, PUT, DELETE',
  allowedHeaders: 'Content-Type, Authorization',
  credentials: true 
}));

// bcrypt
const bcrypt = require("bcrypt");

// MongoDB Mongoose et dotenv
require("dotenv").config();
var mongoose = require("mongoose");
const Message = require("./models/Message");
const User = require("./models/User");
const Invoice = require("./models/Invoice");
const Basket = require("./models/Basket");
const Product = require("./models/Product");
const { log } = require("console");
const url = process.env.DATABASE_URL;
mongoose
  .connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.log(err);
  });

// EJS :
app.set("view engine", "ejs");

// BodyParser
const bodyParser = require("body-parser");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Method-override :
const methodOverride = require("method-override");
app.use(methodOverride("_method"));

// Moment
const moment = require("moment");

// Multer pour gérer les fichiers
const multer = require("multer");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

// Donner accès au dossier public
app.use("/public", express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use("/cartItem.json", express.static("cartItem.json"));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const cookieParser = require("cookie-parser");
app.use(cookieParser());

// npm install toobusy-js
const toobusy = require("toobusy-js");
app.use(function (req, res, next) {
  if (toobusy()) {
    res.status(503).send("Server too busy");
  } else {
    next();
  }
});

//  - - - - - - - - - - U S E R - - - - - - - - - - - //

// Page d'accueil
app.get("/", (req, res) => {
  const user = req.session.user;
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  res.render("home", { user: user, heure: heure });
});

// Inscription
app.get("/register", (req, res) => {
  const user = req.session.user;
  res.json(user);
});
app.post("/register", function (req, res) {
  const userData = new User({
    prenom: req.body.prenom,
    email: req.body.email,
    password: bcrypt.hashSync(req.body.password, 10),
    role: req.body.role,
  });
  userData
    .save()
    .then(() => {
      res.redirect("/login");
    })
    .catch((err) => {
      console.log(err);
    });
});

// Connexion
app.get("/login", (req, res) => {
  res.status(200).send("Login GET route");
});
app.post("/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  console.log("Node login : "+email, password);
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ error: "Email invalide" });
  }
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ error: "Mot de passe invalide" });
  }
  req.session.user = user;
  // console.log("node user : "+user); // fonctinnel
  const data = user;
  return res.json({ success: true, data });
});



// Déconnexion
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    return err
      ? (console.log(err),
        res.status(500).send("Erreur lors de la déconnexion"))
      : res.sendStatus(200);
  });
});

// Compte user
app.get("/account", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  const user = req.session.user;
  res.render("Account", { user: user });
});

// Modifier compte
app.get("/edit-user/:id", (req, res) => {
  const user = req.session.user;
  User.findById(req.params.id)
    .then((user) => {
      res.render("EditFormUser", { user: user, user: user });
    })
    .catch((err) => {
      console.log(err);
    });
});
app.put("/edit-user/:id", (req, res) => {
  const userData = {};
  userData.prenom = req.body.prenom;
  userData.email = req.body.email;
  if (req.body.password !== "") {
    userData.password = bcrypt.hashSync(req.body.password, 10);
  }
  if (!req.body.role) {
    userData.role = req.body.roleDefault;
  }
  if (req.body.role) {
    userData.role = req.body.role;
  }
  User.findByIdAndUpdate(req.params.id, userData)
    .then(() => {
      res.redirect(`/account`);
    })
    .catch((err) => {
      console.log(err);
    });
});

// DELETE
app.delete("/delete-user/:id", (req, res) => {
  User.findByIdAndRemove(req.params.id)
    .then(() => {
      res.redirect("/logout");
    })
    .catch((err) => {
      console.log(err);
    });
});

// -------------------- C O U R R I E R -------------------- //

// Envoier courrier
app.get("/message/new", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  const user = req.session.user;
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  const expediteur = req.query.expediteur;
  const destinataire = req.query.destinataire;
  res.render("messageForm", {
    user: user,
    heure: heure,
    expediteur: expediteur,
    destinataire: destinataire,
  });
});
app.post("/message", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  const messageData = new Message({
    expediteur: req.body.expediteur,
    destinataire: req.body.destinataire,
    texte: req.body.texte,
    date: heure,
  });
  messageData
    .save()
    .then(() => res.redirect(`/messagebox/sent`))
    .catch((err) => {
      console.log(err);
    });
});

// Courriers reçus
app.get("/messagebox/received", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  const user = req.session.user;
  const destinataire =
    req.session.user.role === "admin" ? "admin@admin" : user.email;
  Message.find({ destinataire })
    .then((messages) => {
      res.render("MessageReceived", {
        heure: heure,
        user: user,
        messages: messages,
      });
    })
    .catch((err) => {
      console.log(err);
      res.redirect("/error");
    });
});

// Courriers Envoyés
app.get("/messagebox/sent", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  const user = req.session.user;
  const expediteur =
    req.session.user.role === "admin" ? "admin@admin" : user.email;
  Message.find({ expediteur })
    .then((messages) => {
      res.render("MessageSent", {
        heure: heure,
        user: user,
        messages: messages,
      });
    })
    .catch((err) => {
      console.log(err);
      res.redirect("/error");
    });
});

// Modifier courrier
app.get("/edit-message/:id", (req, res) => {
  const user = req.session.user;
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  Message.findById(req.params.id)
    .then((message) => {
      res.render("EditMessage", {
        message: message,
        user: user,
        heure: heure,
      });
    })
    .catch((err) => {
      console.log(err);
    });
});
app.put("/edit-message/:id", (req, res) => {
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  const messageData = {
    expediteur: req.body.expediteur,
    destinataire: req.body.destinataire,
    texte: req.body.texte,
    date: heure,
  };
  Message.findByIdAndUpdate(req.params.id, messageData)
    .then(() => {
      res.redirect(`/messagebox/sent`);
    })
    .catch((err) => {
      console.log(err);
    });
});

// Effacer courrier
app.delete("/delete-message/received/:messageId", (req, res) => {
  const messageId = req.params.messageId;
  Message.findByIdAndRemove(messageId)
    .then(() => {
      res.redirect(`/messagebox/received`);
    })
    .catch((err) => {
      console.log(err);
      res.redirect("/");
    });
});

// -------------------- P R O D U I T S -------------------- //

// Afficher produits
app.get("/products", (req, res) => {
  const user = req.session.user;
  Product.find()
    .then(
      (data) => {
        res.json(data);
      },
      { user: user }
    )
    .catch((err) => console.log(err));
});

// Ajouter produit
app.get("/product/new", (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== "admin") {
    return res.redirect("/login");
  }
  res.render("ProductForm", { user: user });
});
app.post("/product/new", upload.single("photo"), (req, res) => {
  const { categorie, nom, prix, description } = req.body;
  const photo = req.file.filename;
  const nouveauProduct = new Product({
    categorie,
    nom,
    prix,
    description,
    photo,
  });
  nouveauProduct
    .save()
    .then(() => res.redirect("/products"))
    .catch((err) => res.render("error", { error: err.message }));
});

// Modifier produit
app.get("/product/edit/:id", (req, res) => {
  const user = req.session.user;
  const productId = req.params.id;
  Product.findById(productId)
    .then(
      (data) => {
        res.json(data);
      },
      { user: user }
    )
    .catch((err) => res.render("error", { error: err.message }));
});
app.post("/product/edit/:id", upload.single("photo"), (req, res) => {
  const productId = req.params.id;
  const { categorie, nom, prix, description } = req.body;
  const photo = req.file ? req.file.filename : undefined;
  Product.findByIdAndUpdate(
    productId,
    { categorie, nom, prix, description, photo },
    { new: true }
  )
    .then((updatedProduct) => {
      res.redirect("/products");
    })
    .catch((err) => res.render("error", { error: err.message }));
});

// Supprimer produit
app.delete("/product/delete/:id", (req, res) => {
  const id = req.params.id;
  Product.findByIdAndDelete(id)
    .then(() => res.sendStatus(204))
    .catch((err) => res.status(500).json({ error: err.message }));
});

// -------------------- P A N I E R -------------------- //

// Afficher panier
app.get("/basket", (req, res) => {
  const user = req.session.user;
  let cartItems = req.cookies.cartItems || [];
  let prix_total = 0;
  cartItems.forEach((item) => {
    item.total = item.product.prix * item.quantite;
    prix_total += item.total;
  });
  res.render("Basket", {
    cartItems: cartItems,
    user: user,
    prix_total: prix_total,
  });
});

// Ajouter au panier
app.post("/add-to-cart/:productId", async (req, res) => {
  const productId = req.params.productId;
  let cartItems = req.cookies.cartItems || [];
  // Vérifier si le produit existe déjà dans le basket
  const existingItem = cartItems.find((item) => item.product.id === productId);
  if (existingItem) {
    existingItem.quantite += 1;
  } // +1 si le produit est présent
  else {
    try {
      const product = await Product.findById(productId);
      if (product) {
        cartItems.push({
          product: {
            id: product._id,
            nom: product.nom,
            prix: product.prix,
          },
          quantite: 1,
        });
      }
    } catch (error) {
      console.log(error);
    }
  }
  res.cookie("cartItems", cartItems);
  res.redirect("/basket");
});

// Modifier Quantité
app.post("/update-quantite/:productId", (req, res) => {
  const productId = req.params.productId;
  const quantite = parseInt(req.body.quantite);
  let cartItems = req.cookies.cartItems || [];
  cartItems.forEach((item) => {
    if (item.product.id === productId) {
      item.quantite = quantite;
    }
  });
  res.cookie("cartItems", cartItems);
  res.redirect("/basket");
});

// Retirer produit du panier
app.get("/removeProduct/:productId", (req, res) => {
  const productId = req.params.productId;
  let cartItems = req.cookies.cartItems || [];
  cartItems = cartItems.filter((item) => item.product.id !== productId);
  res.cookie("cartItems", cartItems);
  res.redirect("/basket");
});

// Vider le panier
app.get("/clearBasket", (req, res) => {
  res.clearCookie("cartItems");
  res.redirect("/basket");
});

// Valider panier
app.post("/validateBasket", async (req, res) => {
  const prixTotal = req.body.prix_total;
  const email = req.body.email;
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  const products = req.cookies.cartItems; // récupère array Products
  try {
    const basket = await Basket.create({
      // Stocker dans la base de donnée
      prix_total: prixTotal,
      email: email,
      products: products,
      date: heure,
    });
    const basketId = basket._id;
    res.clearCookie("cartItems"); // Vider le panier
    // Envoyer l'email et l'id du panier vers "/order"
    // res.redirect('/confirmation?email=' + encodeURIComponent(email));
    res.redirect("/order?email=" + email + "&basketId=" + basketId);
  } catch (error) {
    console.log(error);
    res.redirect("/erreur");
  }
});

// Confirmation panier
app.get("/order", (req, res) => {
  // Récupérer l'email et l'id du panier via la requête
  const basketId = req.query.basketId;
  const email = req.query.email;
  const user = req.session.user;
  res.render("Order", { email: email, user: user, basketId: basketId });
});

// Paiement succès
app.get("/payementsuccess", async (req, res) => {
  // Récupérer l'ID du panier depuis la requête
  const basketId = req.query.basketId;
  const user = req.session.user;
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  try {
    const invoice = new Invoice({ basketId: basketId, date: heure });
    await invoice.save();
    const invoiceId = invoice._id;
    res.render("PaymentSuccess", {
      user: user,
      basketId: basketId,
      invoiceId: invoiceId,
    });
  } catch (error) {
    console.log(error);
    res.redirect("/erreur");
  }
});

server.listen(5000, () => {
  console.log("Serveur http://localhost:5000");
});

// Chargement des dépendances
const express = require("express");
const helmet = require("helmet");
const path = require("path");
const session = require("express-session");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const toobusy = require("toobusy-js");
const bcrypt = require("bcrypt");
const moment = require("moment"); 

// Création de l'application Express
const app = express();

// GROUPE 1 : Middlewares DIVERS
// 1 : Traitement JSON, Urlencodées
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2 : Serveur et fichiers statiques
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use("/cartItem.json", express.static("cartItem.json"));

// 3 : Performance, gestion de la surcharge
app.use(function (req, res, next) {
  if (toobusy()) {
    res.status(503).send("Serveur trop occupé");
  } else {
    next();
  }
});

// 4 : Téléchargements de fichiers limités à 5MB
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5,
  },
});

// GROUPE 2 : Middlewares pour la base de données
// Connexion à MongoDB
require("dotenv").config();
const url = process.env.DATABASE_URL;
mongoose
  .connect(url, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
  })
  .then(() => {
    console.log("MongoDB connectée");
  })
  .catch((err) => {
    console.log(err);
  });

// Modèles, collections MongoDB
const Message = require("./models/Message");
const User = require("./models/User");
const Invoice = require("./models/Invoice");
const Basket = require("./models/Basket");
const Product = require("./models/Product");

// GROUPE 3 : Middlewares pour la sécurité
// En-têtes de sécurité renforcées
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "http://localhost:5000"],
    },
  })
);

// Partage de ressources entre domaines différents
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: "GET, POST, PUT, DELETE",
    allowedHeaders: "Content-Type, Authorization",
    credentials: true,
  })
);

// Session
const isProd = process.env.NODE_ENV === "production";
app.use(
  session({
    key: "userId",
    secret: "1234",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: isProd ? "None" : "Lax",
      secure: isProd,
    },
  })
);

app.use(cookieParser());

// Vérification du rôle administrateur
const requireAdmin = (req, res, next) => {
  const user = req.session.user;
  if (!user) {
    return res
      .status(401)
      .json({ success: false, error: "Accès non autorisé" });
  }
  if (user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, error: "Requiert un rôle administrateur" });
  }
  next();
};

//  - - - - - - - - - - U S E R - - - - - - - - - - - //

// ajouté //
// récupérer tous les utilisateurs
app.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await User.find();
    res.json({ success: true, users });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Erreur interne du serveur" });
  }
});

// ajouté //
// Route pour modifier le rôle d'un utilisateur
app.post("/admin/user/:id/role", requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!role) {
    return res
      .status(400)
      .json({ success: false, error: "Le rôle est requis" });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "Utilisateur non trouvé" });
    }
    res.json({ success: true, message: "Rôle mis à jour", user });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Erreur interne du serveur" });
  }
});

// Page d'accueil
app.get("/", (req, res) => {
  const user = req.session.user;
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  res.json({ user: user, heure: heure });
});

// Inscription
app.get("/register", (req, res) => {
  const user = req.session.user;
  res.json(user);
});
app.post("/register/new", function (req, res) {
  const prenom = req.body.prenom;
  const email = req.body.email;
  const password = bcrypt.hashSync(req.body.password, 10);
  const role = req.body.role;
  const formData = new User({ prenom, email, password, role });
  formData
    .save()
    .then(() => {
      res.json({
        success: true,
        message: "Inscription réussie!",
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({
        success: false,
        error: "Erreur lors de l'inscription",
      });
    });
});

// Connexion
app.get("/login", async (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ success: true, data: req.session.user });
  } else {
    return res.status(200).send("Aucune persone connecté");
  }
});
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Email invalide",
      });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(400)
        .json({ success: false, error: "Mot de passe invalide" });
    }
    req.session.user = user;
    return res.json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Erreur serveur",
    });
  }
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
  res.json(user);
});

// Modifier compte
app.get("/edit-user/:id", (req, res) => {
  User.findById(req.params.id)
    .then((user) => {
      res.json(user);
    })
    .catch((err) => {
      console.log(err);
    });
});

// Modifier compte
app.post("/edit-user/:id", async (req, res) => {
  const data = {
    prenom: req.body.prenom,
    email: req.body.email,
  };

  if (req.body.password) {
    try {
      const hashedPassword = bcrypt.hashSync(req.body.password, 10);
      data.password = hashedPassword;
    } catch (err) {
      return res
        .status(500)
        .json({ error: "Erreur lors du hashage du mot de passe." });
    }
  }

  if (req.body.role) {
    data.role = req.body.role;
  } else {
    data.role = req.body.roleDefault;
  }

  User.findByIdAndUpdate(req.params.id, data, { new: true })
    .then((user) => {
      res.status(200).json({
        message: "Mise à jour réussie",
        user: user,
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: "Erreur interne du serveur" });
    });
});

// DELETE
// app.delete("/delete-user/:id", (req, res) => {
//   User.findByIdAndRemove(req.params.id)
//     .then(() => { res.redirect("/logout"); })
//     .catch((err) => { console.log(err); });
// });
app.delete("/delete-user/:id", requireAdmin, async (req, res) => {
  try {
    await User.findByIdAndRemove(req.params.id);
    res.json({ success: true, message: "Utilisateur supprimé" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Erreur interne du serveur" });
  }
});

// -------------------- M E S S A G E -------------------- //

app.post("/message", (req, res) => {
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  const messageData = new Message({
    expediteur: req.body.expediteur,
    destinataire: req.body.destinataire,
    texte: req.body.texte,
    date: heure,
    lu: false,
  });
  messageData
    .save()
    .then(() =>
      res.json({ success: true, message: "Message envoyé avec succès" })
    )
    .catch((err) => {
      console.log(err);
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'envoi du message.",
      });
    });
});

// Messages reçus
app.get("/messagereceived", (req, res) => {
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  if (!req.session.user) {
    return res.status(401).json({
      error: "Utilisateur non connecté ou session expirée.",
    });
  }
  const user = req.session.user;
  const destinataire = user.role === "admin" ? "admin@admin" : user.email;
  Message.find({ destinataire })
    .then((messages) => {
      res.json({
        heure: heure,
        user: user,
        messages: messages,
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: "Erreur serveur" });
    });
});

// Messages Envoyés
app.get("/messagesent", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non autorisé" });
  }
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  const user = req.session.user;
  const expediteur =
    req.session.user.role === "admin" ? "admin@admin" : user.email;
  Message.find({ expediteur })
    .then((messages) => {
      res.json({
        heure: heure,
        user: user,
        messages: messages,
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: "Erreur serveur" });
    });
});

// Modifier message
app.get("/editmessage/:id", (req, res) => {
  const user = req.session.user;
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  Message.findById(req.params.id)
    .then((message) => {
      res.json({ message: message, user: user, heure: heure });
    })
    .catch((err) => {
      console.log(err);
    });
});

app.put("/editmessage/:id", (req, res) => {
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  const messageData = {
    expediteur: req.body.expediteur,
    destinataire: req.body.destinataire,
    texte: req.body.texte,
    date: heure,
    lu: false,
  };
  Message.findByIdAndUpdate(req.params.id, messageData)
    .then(() => {
      res.json({ message: "Message updated successfully!" });
    })
    .catch((err) => {
      console.log(err);
      res
        .status(500)
        .json({ error: "An error occurred while updating the message" });
    });
});

// Mettre à jour le statut de lecture d'un message
app.put("/markasread/:id", (req, res) => {
  const messageId = req.params.id;
  Message.findByIdAndUpdate(messageId, { lu: true })
    .then(() => {
      res.json({ message: "Le message a été marqué comme lu." });
    })
    .catch((err) => {
      console.error(err);
      res
        .status(500)
        .json({
          error: "Une erreur s'est produite lors de la mise à jour du message.",
        });
    });
});

// Effacer message
app.delete("/deletemessage/:id", (req, res) => {
  const id = req.params.id;
  Message.findByIdAndRemove(id)
    .then(() => res.sendStatus(204))
    .catch((err) => res.status(500).json({ error: err.message }));
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
  res.json({ user: user });
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
    .catch((err) => res.json({ error: err.message }));
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
    .catch((err) => res.json({ error: err.message }));
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
    .catch((err) => res.json({ error: err.message }));
});

// Supprimer produit
app.delete("/product/delete/:id", (req, res) => {
  const id = req.params.id;
  Product.findByIdAndDelete(id)
    .then(() => res.sendStatus(204))
    .catch((err) => res.status(500).json({ error: err.message }));
});

// -------------------- P A N I E R -------------------- //

app.get("/basket", (req, res) => {
  const user = req.session.user;
  let cartItems = req.cookies.cartItems || [];
  let prix_total = 0;
  cartItems.forEach((item) => {
    item.total = item.product.prix * item.quantite;
    prix_total += item.total;
  });
  res.json({ cartItems: cartItems, user: user, prix_total: prix_total });
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
          product: { id: product._id, nom: product.nom, prix: product.prix },
          quantite: 1,
        });
      }
    } catch (error) {
      console.log(error);
    }
  }
  res.cookie("cartItems", cartItems, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });
  res.redirect("/basket");
});

// Modifier les Quantités de tous les produits
app.post("/update-quantities", (req, res) => {
  const updatedQuantities = req.body;
  let cartItems = req.cookies.cartItems || [];
  for (const productId in updatedQuantities) {
    const item = cartItems.find((item) => item.product.id === productId);
    if (item) {
      item.quantite = parseInt(updatedQuantities[productId]);
    }
  }
  res.cookie("cartItems", cartItems, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });
  res.json({ success: true, message: "Quantités mises à jour avec succès." });
});

// Retirer produit du panier
app.get("/removeProduct/:productId", (req, res) => {
  const productId = req.params.productId;
  let cartItems = req.cookies.cartItems || [];
  cartItems = cartItems.filter((item) => item.product.id !== productId);
  res.cookie("cartItems", cartItems, {
    httpOnly: true,
    sameSite: "none",
    secure: false,
  });
  res.json({ success: true, message: "Produit retiré avec succès." });
});
// Vider le panier
app.get("/clearBasket", (req, res) => {
  res.clearCookie("cartItems");
  res.json({ success: true, message: "Panier vidé avec succès." });
});

// Valider panier
app.post("/validateBasket", async (req, res) => {
  const prixTotal = req.body.prix_total;
  const email = req.body.email;
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  const products = req.cookies.cartItems; // récupère array Products
  try {
    // Stocker dans la base de donnée
    const basket = await Basket.create({
      prix_total: prixTotal,
      email: email,
      products: products,
      date: heure,
    });
    const basketId = basket._id;
    res.clearCookie("cartItems"); // Vider le panier
    res.json({ success: true, email: email, basketId: basketId });
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: "Une erreur est survenue lors de la validation du panier.",
    });
  }
});

// Confirmation panier
app.get("/order/:basketId", async (req, res) => {
  const basketId = req.params.basketId;
  try {
    const basket = await Basket.findById(basketId);
    if (!basket) {
      return res
        .status(404)
        .json({ success: false, message: "Panier non trouvé." });
    }
    res.json(basket);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des détails du panier.",
    });
  }
});

// Paiement succès
app.post("/createInvoice", async (req, res) => {
  // Récupérer l'ID du panier depuis la requête
  const basketId = req.body.basketId;
  const heure = moment().format("DD-MM-YYYY, h:mm:ss");
  try {
    const invoice = new Invoice({ basketId: basketId, date: heure });
    await invoice.save();
    const invoiceId = invoice._id;
    res.json({ success: true, invoiceId: invoiceId });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

app.get("/payementsuccess/:invoiceId", async (req, res) => {
  const invoiceId = req.params.invoiceId;
  const user = req.session.user;
  try {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.redirect("/erreur");
    }
    res.json({ user: user, basketId: invoice.basketId, invoiceId: invoiceId });
  } catch (error) {
    console.log(error);
    res.redirect("/erreur");
  }
});

app.listen(5000, () => {
  console.log(`Server is running on 5000 ${5000}`);
});
//  - - - - - - - - -D E P E N D A N C E S- - - - - - - - - - //
//                          M A I N                             //
// express & express-session
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;
const session = require("express-session");
const http = require("http");
const server = http.createServer(app);

// Configurer express-session
app.use(session({
  key: "userId",
  secret: "1234",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'none', 
    secure: false,    
  },
}));

app.set('views', path.join(__dirname, 'views'));


// CORS :
const cors = require("cors");
app.use(cors({
  origin: 'http://localhost:3000',
  methods: 'GET, POST, PUT, DELETE',
  allowedHeaders: 'Content-Type, Authorization',
  credentials: true
}));

// Parse JSON and urlencoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// bcrypt
const bcrypt = require("bcrypt");

// EJS :
app.set("view engine", "ejs");

// MongoDB Mongoose et dotenv
require("dotenv").config();
var mongoose = require("mongoose");
const url = process.env.DATABASE_URL;
mongoose
  .connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.log(err);
  });

const Message = require("./models/Message");
const User = require("./models/User");
const Invoice = require("./models/Invoice");
const Basket = require("./models/Basket");
const Product = require("./models/Product");



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
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use("/cartItem.json", express.static("cartItem.json"));

const cookieParser = require("cookie-parser");
app.use(cookieParser());

// Too busy
const toobusy = require("toobusy-js");
app.use(function (req, res, next) {
  if (toobusy()) {
    res.status(503).send("Server too busy");
  } else {
    next();
  }
});


app.use(helmet.contentSecurityPolicy({
  directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "https://uppercase-back-1eec3e8a2cf1.herokuapp.com"]
  }
}));


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
app.post("/register/new", function (req, res) {
  const prenom = req.body.prenom;
  const email = req.body.email;
  const password = bcrypt.hashSync(req.body.password, 10);
  const role = req.body.role;
  // console.log(prenom, email, password, role);
  const formData = new User({
    prenom,
    email,
    password, 
    role,
  });
  
  formData
  .save()
  .then(() => {
    res.json({ success: true, message: "Inscription réussie!" });
  })
  .catch((err) => {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur lors de l'inscription" });
  });
});



// Connexion
app.get("/login", async (req, res) => {
  if (req.session && req.session.user) {
      return res.json({ success: true, data: req.session.user });
  } else {
      return res.status(200).send("Login GET route");
  }
});


app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, error: "Email invalide" });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ success: false, error: "Mot de passe invalide" });
    }
    req.session.user = user;
    return res.json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Erreur serveur" });
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

app.get('/message/new', (req, res) => {
  const user = req.session.user;
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  const expediteur = req.query.expediteur;
  const destinataire = req.query.destinataire;
  res.json({
    user: user,
    heure: heure,
    expediteur: expediteur,
    destinataire: destinataire
  });
});

app.post('/message', (req, res) => {
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  const messageData = new Message({
    expediteur: req.body.expediteur,
    destinataire: req.body.destinataire,
    texte: req.body.texte,
    date: heure
  });
  messageData.save()
  .then(() => res.json({ success: true, message: 'Message envoyé avec succès' }))
  .catch(err => {
    console.log(err);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi du message.' });
  });
});

// Courriers reçus
app.get('/messagereceived', (req, res) => {
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  const user = req.session.user;
  const destinataire = req.session.user.role === "admin" ? "admin@admin" : user.email;
  Message.find({ destinataire })
    .then((messages) => {
      res.json({
        heure: heure,
        user: user,
        messages: messages
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: 'Erreur serveur' }); 
    });
});


// Courriers Envoyés
app.get('/messagesent', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  const user = req.session.user;
  const expediteur = req.session.user.role === "admin" ? "admin@admin" : user.email;
  Message.find({ expediteur })
  .then((messages)=>{
    res.json({
      heure: heure, 
      user: user, 
      messages: messages 
    });
  })
  .catch((err) => {
    console.log(err);
    res.status(500).json({ error: 'Erreur serveur' }); 
  });
});

// Modifier courrier
app.get('/editmessage/:id', (req, res) => {
  const user = req.session.user;
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  Message.findById(req.params.id)
    .then((message) => {
      res.json({ message: message, user: user, heure: heure });
    })
    .catch(err => { console.log(err); });
});

app.put('/editmessage/:id', (req, res) => {
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  const messageData = {
    expediteur: req.body.expediteur,
    destinataire: req.body.destinataire,
    texte: req.body.texte,
    date: heure,
  };
  Message.findByIdAndUpdate(req.params.id, messageData)
    .then(() => {
      res.json({ message: 'Message updated successfully!' });
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({ error: 'An error occurred while updating the message' });
    });
});

  // Effacer courrier 
  app.delete('/deletemessage/:id', (req, res) => {
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

app.get('/basket', (req, res) => {
  const user = req.session.user;
  let cartItems = req.cookies.cartItems || [];
  let prix_total = 0;

  cartItems.forEach(item => {
      item.total = item.product.prix * item.quantite;
      prix_total += item.total;
  });

  // Envoi de la réponse en JSON
  res.json({
      cartItems: cartItems,
      user: user, 
      prix_total: prix_total
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
  res.cookie("cartItems", cartItems, { httpOnly: true, sameSite: 'none', secure: true });
  res.redirect("/basket");
});


// Modifier Quantité d'un produit spécifique
app.post("/update-quantite/:productId", (req, res) => {
  const productId = req.params.productId;
  const quantite = parseInt(req.body.quantite);
  let cartItems = req.cookies.cartItems || [];
  
  const item = cartItems.find(item => item.product.id === productId);
  if (item) {
    item.quantite = quantite;
  }

  res.cookie("cartItems", cartItems, { httpOnly: true, sameSite: 'none', secure: false });
  res.json({ success: true, message: "Quantité mise à jour avec succès." });
});

// Modifier les Quantités de tous les produits
app.post('/update-quantities', (req, res) => {
  const updatedQuantities = req.body;
  let cartItems = req.cookies.cartItems || [];

  for (const productId in updatedQuantities) {
      const item = cartItems.find(item => item.product.id === productId);
      if (item) {
          item.quantite = parseInt(updatedQuantities[productId]);
      }
  }

  res.cookie("cartItems", cartItems, { httpOnly: true, sameSite: 'none', secure: true });
  res.json({ success: true, message: "Quantités mises à jour avec succès." });
});

// Retirer produit du panier
app.get("/removeProduct/:productId", (req, res) => {
  const productId = req.params.productId;
  let cartItems = req.cookies.cartItems || [];
  
  cartItems = cartItems.filter(item => item.product.id !== productId);
  
  res.cookie("cartItems", cartItems, { httpOnly: true, sameSite: 'none', secure: false });
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
    const basket = await Basket.create({
      // Stocker dans la base de donnée
      prix_total: prixTotal,
      email: email,
      products: products,
      date: heure,
    });
    const basketId = basket._id;
    res.clearCookie("cartItems"); // Vider le panier
    // Envoyer l'email et l'id du panier sous forme de réponse JSON
    res.json({ success: true, email: email, basketId: basketId });
  } catch (error) {
    console.log(error);
    // Renvoyer une erreur sous forme de réponse JSON
    res.json({ success: false, message: "Une erreur est survenue lors de la validation du panier." });
  }
});


// Confirmation panier
app.get("/order/:basketId", async (req, res) => {
    const basketId = req.params.basketId;
    try {
        const basket = await Basket.findById(basketId);
        if (!basket) {
            return res.status(404).json({ success: false, message: "Panier non trouvé." });
        }
        res.json(basket);
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Erreur lors de la récupération des détails du panier." });
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
    
    // Au lieu de rediriger, renvoyer l'ID de la facture dans une réponse JSON
    res.json({ success: true, invoiceId: invoiceId });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
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
    res.render("PaymentSuccess", {
      user: user,
      basketId: invoice.basketId,
      invoiceId: invoiceId,
    });
  } catch (error) {
    console.log(error);
    res.redirect("/erreur");
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

//  - - - - - - - - -D E P E N D A N C E S- - - - - - - - - - //

// express & express-session
const express = require('express');
const session = require('express-session');
const app = express();
const http = require('http').createServer(app);

// config express-session
app.use(session({
  secret: '1234',
  resave: false,
  saveUninitialized: true,
}));

// bcrypt
const bcrypt = require('bcrypt');

// MongoDB Mongoose et dotenv
require('dotenv').config();
var mongoose = require('mongoose');
const IoMsg = require('./models/IoMsg');
const Message = require('./models/Message');
const User = require('./models/User');
const Facture = require('./models/Facture');
const Panier = require('./models/Panier');
const Produit = require('./models/Produit');
const { log } = require('console');
const url = process.env.DATABASE_URL;
mongoose.connect(url, {useNewUrlParser: true,useUnifiedTopology: true})
.then(() => {console.log("MongoDB connected");})
.catch(err => {console.log(err);});

// EJS : 
app.set('view engine', 'ejs');

// BodyParser
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));

// Method-override :
const methodOverride = require('method-override');
app.use(methodOverride('_method'));

// Moment 
const moment = require('moment'); 

// Multer pour gérer les fichiers
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

// Donner accès au dossier public
app.use('/public', express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/cartItem.json', express.static('cartItem.json'));


const cookieParser = require('cookie-parser');
app.use(cookieParser());


//  - - - - - - - - - - U S E R - - - - - - - - - - - //

// Page d'accueil
app.get('/', (req, res) => {
  const user = req.session.user;
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  res.render('home', { user: user, heure: heure} ); 
});

// Inscription
app.get('/register', (req, res) => {
  const user = req.session.user;
  res.render('RegisterForm', { user: user });
});
app.post('/register', function(req, res){
const userData = new User({
  prenom: req.body.prenom,
  email: req.body.email,
  password: bcrypt.hashSync(req.body.password,10),
  role: req.body.role
  })
  userData.save()
    .then(()=>{ res.redirect('/login')})
    .catch((err)=>{console.log(err); 
  });
});

// Connexion
app.get('/login', (req, res) => {
  const user = req.session.user;
  res.render('LoginForm', { user: user });
});
app.post('/login', (req, res) => {
User.findOne({ email: req.body.email }).then(user => {
  if (!user) {res.send('email invalide');}
  if (!bcrypt.compareSync(req.body.password, user.password)) {
    res.send('Mot de passe invalide');}
    req.session.user = user;
    // req.session.user = {prenom: user.prenom} ;
  res.redirect('/compte');
})
.catch(err => console.log(err));
});

// Déconnexion
app.get('/logout', (req, res) => {
req.session.destroy((err) => {
  if (err) {console.log(err);} 
  else {res.redirect('/login');}
});
});

// Compte user
app.get('/compte', (req, res) => {
  
  if (!req.session.user) { return res.redirect('/login');}
  const user = req.session.user;
  res.render('compte', {user: user });
  });

// Modifier compte 
app.get('/edit-user/:id', (req, res) => {
  const user = req.session.user;
  User.findById(req.params.id)
  .then((user) => {res.render('EditFormUser',{user: user , user: user });})
  .catch(err => {console.log(err);});
});
app.put('/edit-user/:id', (req, res) => {
  const userData = {};
    userData.prenom = req.body.prenom;
    userData.email = req.body.email;
    if (req.body.password !== ""){
      userData.password = bcrypt.hashSync(req.body.password,10)}
    if (!req.body.role) { userData.role = req.body.roleDefault}
    if (req.body.role) { userData.role = req.body.role}
  User.findByIdAndUpdate(req.params.id, userData)
    .then(() => {res.redirect(`/compte`);})
    .catch(err => {console.log(err);});
  });

// DELETE 
app.delete('/delete-user/:id', (req, res) => {
  User.findByIdAndRemove(req.params.id)
  .then(() => {res.redirect("/logout");})
  .catch(err => {console.log(err);});
});

// -------------------- C O U R R I E R -------------------- //

// Envoier courrier
app.get('/message/new', (req, res) => {
  if (!req.session.user){return res.redirect('/login');}
  const user = req.session.user;
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  const expediteur = req.query.expediteur;
  const destinataire = req.query.destinataire;
  res.render('messageForm', {
    user: user,
    heure: heure,
    expediteur: expediteur,
    destinataire: destinataire
  });
});
app.post('/message', (req, res) => {
  if (!req.session.user){return res.redirect('/login');}
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  const messageData = new Message({
    expediteur: req.body.expediteur,
    destinataire: req.body.destinataire,
    texte: req.body.texte,
    date: heure
  });
  messageData.save()
  .then(() => res.redirect(`/messagebox/sent`))
  .catch(err => {console.log(err);});
});

// Courriers reçus
app.get('/messagebox/received', (req, res) => {
  if (!req.session.user) {return res.redirect('/login');}
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  const user = req.session.user;
  const destinataire = req.session.user.role === "admin" ? "admin@admin" : user.email;
  Message.find({ destinataire })
    .then((messages) => {
      res.render('MessageReceived',{heure: heure, user: user, messages: messages });
    })
    .catch((err) => {console.log(err);res.redirect('/error');});
});

// Courriers Envoyés
app.get('/messagebox/sent', (req, res) => {
  if (!req.session.user) {return res.redirect('/login');}
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  const user = req.session.user;
  const expediteur = req.session.user.role === "admin" ? "admin@admin" : user.email;
  Message.find({ expediteur })
  .then((messages)=>{res.render(
    'MessageSent',{heure: heure, user: user, messages: messages });
  })
  .catch((err) => {console.log(err);res.redirect('/error');});
});

// Modifier courrier
app.get('/edit-message/:id', (req, res) => {
  const user = req.session.user;
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  Message.findById(req.params.id)
    .then((message) => {res.render('EditMessage', { 
      message: message , user: user, heure: heure });})
    .catch(err => {console.log(err);});
  });
app.put('/edit-message/:id', (req, res) => {
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  const messageData = {
    expediteur:  req.body.expediteur,
    destinataire: req.body.destinataire,
    texte: req.body.texte,
    date: heure
  };
  Message.findByIdAndUpdate(req.params.id, messageData)
    .then(() => {res.redirect(`/messagebox/sent`);})
    .catch(err => {console.log(err);});
  });

  // Effacer courrier 
  app.delete('/delete-message/received/:messageId', (req, res) => {
    const messageId = req.params.messageId;
    Message.findByIdAndRemove(messageId)
    .then(() => {res.redirect(`/messagebox/received`);})
    .catch(err => {console.log(err);res.redirect('/'); });
  });

// -------------------- P R O D U I T S -------------------- //

// Afficher produits
app.get('/products', (req, res) => {
  const user = req.session.user;
  Produit.find()
  .then(products => { res.render('allProducts',{ produits: products , user: user});})
  .catch(err => res.render('error', { error: err.message }));
});

// Ajouter produit
app.get('/products/new', (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== "admin") {return res.redirect('/login');}
  res.render('ProductForm', { user: user });
});
app.post('/products', upload.single('photo'), (req, res) => {
  const { categorie, nom, prix, description } = req.body;
  const photo = req.file.filename; // Récupérer le nom du fichier photo
  const nouveauProduit = new Produit({ categorie, nom, prix, description, photo});
  nouveauProduit.save()
  .then(() => res.redirect('/products'))
  .catch(err => res.render('error', { error: err.message }));
});

// Modifier produit
app.get('/products/:id/edit', (req, res) => {
  const user = req.session.user;
  const productId = req.params.id;
  Produit.findById(productId)
  .then(product => { res.render('EditProduct', { product, user: user });})
  .catch(err => res.render('error', { error: err.message }));
});
app.post('/products/:id', upload.single('photo'), (req, res) => {
  const productId = req.params.id;
  const { categorie, nom, prix, description } = req.body;
  const photo = req.file ? req.file.filename : undefined;
  Produit.findByIdAndUpdate(
    productId,{categorie, nom, prix, description, photo },{ new: true })
  .then(updatedProduct => { res.redirect('/products');})
  .catch(err => res.render('error', { error: err.message }));
});

// Supprimer produit
app.get('/products/:id/delete', (req, res) => {
  const productId = req.params.id; 
  Produit.findByIdAndDelete(productId)
  .then(() => res.redirect('/products'))
  .catch(err => res.render('error', { error: err.message }));
});

// -------------------- P A N I E R -------------------- //

// Afficher panier
app.get('/panier', (req, res) => {
  const user = req.session.user;
  let cartItems = req.cookies.cartItems || [];
  let prix_total = 0;
  cartItems.forEach(item => {
    item.total = item.produit.prix * item.quantite;
    prix_total += item.total;
  });
  res.render('Panier', { cartItems: cartItems, user: user, prix_total: prix_total });
});

// Ajouter au panier
app.post('/add-to-cart/:produitId', async (req, res) => {
  const produitId = req.params.produitId;
  let cartItems = req.cookies.cartItems || [];
  // Vérifier si le produit existe déjà dans le panier
  const existingItem = cartItems.find(item => item.produit.id === produitId);
  if (existingItem) { existingItem.quantite += 1;} // +1 si le produit est présent
  else {
    try { const produit = await Produit.findById(produitId);
      if (produit) {
        cartItems.push({
          produit: {
            id: produit._id,
            nom: produit.nom,
            prix: produit.prix
          },
          quantite: 1
        });
      }
    } 
    catch (error) { console.log(error); }
  }
  res.cookie('cartItems', cartItems);
  res.redirect('/panier');
});

// Modifier Quantité 
app.post('/update-quantite/:produitId', (req, res) => {
  const produitId = req.params.produitId;
  const quantite = parseInt(req.body.quantite);
  let cartItems = req.cookies.cartItems || [];
  cartItems.forEach(item => {
    if (item.produit.id === produitId) { item.quantite = quantite; }
  });
  res.cookie('cartItems', cartItems);
  res.redirect('/panier');
});

 // Retirer produit du panier
app.get('/retirer-produit/:produitId', (req, res) => {
  const produitId = req.params.produitId;
  let cartItems = req.cookies.cartItems || [];
  cartItems = cartItems.filter(item => item.produit.id !== produitId);
  res.cookie('cartItems', cartItems);
  res.redirect('/panier');
});

// Vider le panier
app.get('/vider-panier', (req, res) => {
  res.clearCookie('cartItems');
  res.redirect('/panier');
});

// Valider panier
app.post('/valider-panier', async (req, res) => {
  const prixTotal = req.body.prix_total;
  const email = req.body.email; 
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  const produits = req.cookies.cartItems; // récupère array produits
  try { 
    const panier = await Panier.create({ // Stocker dans la base de donnée
      prix_total: prixTotal,
      email: email,
      produits: produits, 
      date: heure
    });
    const panierId = panier._id;
    res.clearCookie('cartItems'); // Vider le panier 
    // Envoyer l'email et l'id du panier vers "/order"
    // res.redirect('/confirmation?email=' + encodeURIComponent(email));
    res.redirect('/order?email='+email+'&panierId=' + panierId);
  } 
  catch (error) { console.log(error); res.redirect('/erreur'); }
});

// Confirmation panier 
app.get('/order', (req, res) => {
  // Récupérer l'email et l'id du panier via la requête
  const panierId = req.query.panierId;
  const email = req.query.email;
  const user = req.session.user;
  res.render('Order', { email: email, user: user, panierId: panierId });
});

// Paiement succès
app.get('/payementsuccess', async (req, res) => {
  // Récupérer l'ID du panier depuis la requête
  const panierId = req.query.panierId; 
  const user = req.session.user;
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  try { 
    const facture = new Facture({ panierId: panierId, date: heure});
    await facture.save();
    const factureId = facture._id;
    res.render('PaymentSuccess', { 
      user: user,panierId: panierId, factureId: factureId 
    });
  } 
  catch (error) {console.log(error);res.redirect('/erreur');}
});


const PORT = 5000;
http.listen(PORT, () => {
  console.log(`Serveur http://localhost:${PORT}`);
});
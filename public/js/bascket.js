// Afficher btn "appliquer" si quantité modifiée
var inputs = document.querySelectorAll('[id^="quantite"]');
inputs.forEach(function(input) {
var button = input.nextElementSibling;
input.addEventListener('input', function() { button.classList.remove('d-none');});
button.addEventListener('click', function() { button.classList.add('d-none');});
});
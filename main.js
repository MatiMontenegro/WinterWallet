/*******************************************Cripto Wallet Init****************************/

//API
const API_URL = 'https://api.coingecko.com/api/v3/exchange_rates'
const getCurrencies = () =>{
    fetch(API_URL)
    .then ((response) => response.json())
    .then ((data) => {
        console.log(data);
        document.getElementById('values').innerHTML = `<p>Valor Base del ${data.rates.btc.name} <br> ${data.rates.ars.name}  =  ${data.rates.ars.value}</p>`;
        arsValue = data.rates.ars.value;
    })
    .catch(() =>{
        document.getElementById('currenciesStatus').innerHTML = (`Valores no encontrados, intente luego.`);
        setTimeout(()=>{
            document.getElementById('currenciesStatus').innerHTML = (`<p class= d-none></p>`);
    },300000)
    })
}
//First time API CALL
getCurrencies();
//Constant Refresh on API call
setInterval(() => {
    getCurrencies();
},300000)

//Users:
const user = {
    name : 'Matias',
    age: 18,
    isRegistered: true,
}
user.isRegistered ? document.getElementById('user').innerHTML = `Bienvenido ${user.name}` : document.getElementById('user').innerHTML =`Bienvenido Guest`;

//Loading Save Values on Local Storage
let wallet = JSON.parse(localStorage.getItem('billetera'));
let btc = JSON.parse(localStorage.getItem('cripto'));

    //Condition(If there's a null result on Local Storage Loading, Set the Wallets To 0)
    if(wallet === null && btc === null){
        wallet=0;
        btc=0;
    }
    
//DOM properties to show values in wallet Ars & BTC
document.getElementById("wallet").innerHTML = `<p>ARS$ ${wallet}  y BTC$ ${btc}  </p>`
document.getElementById("wallet-sidebar").innerHTML = `<p>ARS$ ${wallet}  y BTC$ ${btc}  </p>`

//Function that buys Crypto
const cryptoTrade = () =>{

    amount = parseInt( document.getElementById('exchange').value);
    if(wallet >= 0 && amount <= wallet){
        wallet -= amount;
        btc += amount/arsValue;
        Swal.fire(
            'Transaccion Completa',
            `Perfecto, compraste ${btc} en BTC`,
            'success'
        )
        document.getElementById("wallet").innerHTML = `<p>ARS$${wallet} y BTC${btc}</p>`;
        document.getElementById("wallet-sidebar").innerHTML = `<p>ARS$ ${wallet}  y BTC$ ${btc}  </p>`
    }
    else if(document.getElementById('amountIn').value = isNaN(amount)){
        document.getElementById('validate').innerHTML = `<p class = " p-2 text-center border border-danger rounded">X No has ingresado un monto en particular, por favor reintenta.</p>`;
        setTimeout(() => {
            document.getElementById('validate').innerHTML = `<p class = "d-none"></p>`;
    },5000)
}
else{
        document.getElementById('validate').innerHTML = `<p class = " p-2 text-center border border-danger rounded">X No contas con dinero para hacer la transaccion</p>`;
        setTimeout(() => {
            document.getElementById('validate').innerHTML = `<p class = "d-none"></p>`;
    },5000)
    }
let arsLoad = localStorage.setItem('billetera', wallet);
let btcLoad = localStorage.setItem('cripto', btc);
    exchange.value='';
    return;
}
//Function that inserts Money
const moneyIn = document.getElementById('amountInBtn') 
moneyIn.onclick = () => { //funcion que ingresa dinero, como es infinito, sin problemas (por ahora, la idea es meter un href a mercadopago.)
    if(amount = parseInt( document.getElementById('amountIn').value)){
        wallet += amount;
        Swal.fire(
            'Transaccion Completa',
            `Felicitaciones, ingresaste ARS$${amount} cantidad de dinero`,
            'success'
            )
            document.getElementById("wallet").innerHTML = `<p>ARS$${wallet} y BTC${btc}</p>`;
            document.getElementById("wallet-sidebar").innerHTML = `<p>ARS$ ${wallet}  y BTC$ ${btc}  </p>`
        }
    else if(document.getElementById('amountIn').value = isNaN(amount)){
        document.getElementById('validate').innerHTML = `<p class = " p-2 text-center border border-danger rounded">X No has ingresado un monto en particular, por favor reintenta.</p>`;
        setTimeout(() => {
            document.getElementById('validate').innerHTML = `<p class = "d-none"></p>`;
    },5000)
    }
let arsLoad = localStorage.setItem('billetera', wallet);
let btcLoad = localStorage.setItem('cripto', btc);
    amountIn.value = '';
    return;
}
//Function that Extracts Money
const moneyOut = document.getElementById('amountOutBtn')
moneyOut.onclick = () =>{ //funcion que saca dinero de input para actualizar wallet.
    amount = parseInt(document.getElementById('amountOut').value);
    if(wallet >= 0 && amount <= wallet){
        wallet -= amount;
        Swal.fire(
            'Transaccion Completa',
            `Felicitaciones, descontaste ARS$${amount} cantidad de dinero`,
            'success'
        )
        document.getElementById("wallet").innerHTML = `<p>ARS$${wallet} y BTC${btc}</p>`;
        document.getElementById("wallet-sidebar").innerHTML = `<p>ARS$ ${wallet}  y BTC$ ${btc}  </p>`;
    }
    
    else if(document.getElementById('amountIn').value = isNaN(amount)){
        document.getElementById('validate').innerHTML = `<p class = " p-2 text-center border border-danger rounded">X No has ingresado un monto en particular, por favor reintenta.</p>`;
        setTimeout(() => {
            document.getElementById('validate').innerHTML = `<p class = "d-none"></p>`;
    },5000)
    }
    else{
        document.getElementById('validate').innerHTML = `<p class = " p-2 text-center border border-danger rounded">X No es posible realizar la transaccion</p>`;
        setTimeout(() => {
            document.getElementById('validate').innerHTML = `<p class = "d-none"></p>`;
    },5000)
}
let arsLoad = localStorage.setItem('billetera', wallet);
let btcLoad = localStorage.setItem('cripto', btc);
    amountOut.value = '';
    return;
}
//trying to set the wallet btc value to change but not to save it.
const apiBTC = 'https://api.coingecko.com/api/v3/coins/bitcoin?tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false';
const updateBTC=()=>{
    fetch (apiBTC)
    .then((response)=>response.json())
    .then((data) =>{
        console.log(data.market_data.price_change_percentage_1h_in_currency);
        calcule = data.market_data.price_change_percentage_1h_in_currency.ars;
        btc += btc % calcule;
        document.getElementById("wallet").innerHTML = `<p>ARS$${wallet} y BTC${btc}</p>`;
        document.getElementById("wallet-sidebar").innerHTML = `<p>ARS$ ${wallet}  y BTC$ ${btc}  </p>`;
    })
}
updateBTC();
setInterval(() => {
updateBTC();
},300000)

//Local Storage, Saving All Transactions.
let arsLoad = localStorage.setItem('billetera', JSON.parse(wallet));
let btcLoad = localStorage.setItem('cripto', JSON.parse(btc));

//Sidebar Menu Button 
var menu_btn = document.querySelector("#menu-btn");
var sidebar = document.querySelector("#sidebar");
var container = document.querySelector(".my-container");
menu_btn.addEventListener("click", () => {
    sidebar.classList.toggle("active-nav");
container.classList.toggle("active-cont");
});

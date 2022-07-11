/*******************************************Cripto Wallet Init****************************/
//Local Storage: Loading Money Last Changes.
// localStorage.getItem('billetera');
// localStorage.getItem('criptomoneda');
//Vars & Objects

// let wallet = [{
//     ars: 0,
//     btc: 0,
//     ada: 0,          //////////TODO: Hacer funcionar el mismo codigo pero que en vez de que wallet represente solo ars, y btc bitcoin, manejar todo unificado.
//     eth: 0,
//     doge: 0,
// }]
    //Cargamos la documentacion guardada en la billetera abajo de todo y solamente falta parsearla.

    let wallet = JSON.parse(localStorage.getItem('billetera'));
    let btc = JSON.parse(localStorage.getItem('cripto'));
  
document.getElementById("wallet").innerHTML = `<p>ARS$ ${wallet}  y BTC$ ${btc}  </p>`
document.getElementById("wallet-sidebar").innerHTML = `<p>ARS$ ${wallet}  y BTC$ ${btc}  </p>`

const cryptoTrade = () =>{ //la idea a futuro es meter API para sacar el valor diario del BTC para poder hacer la conversion

    amount = parseInt( document.getElementById('exchange').value);
    if(wallet >= 0 && amount <= wallet){
        wallet -= amount;
        btc += amount/3802620.70;
        Swal.fire(
            'Transaccion Completa',
            `Perfecto, compraste ${btc} en BTC`,
            'success'
          )
    //    alert(`Perfecto, compraste ${btc} en BTC`);
        document.getElementById("wallet").innerHTML = `<p>ARS$${wallet} y BTC${btc}</p>`;
        document.getElementById("wallet-sidebar").innerHTML = `<p>ARS$ ${wallet}  y BTC$ ${btc}  </p>`
    }
    else if(document.getElementById('amountIn').value = isNaN(amount)){
        document.getElementById('validate').innerHTML = `<p class = " p-2 text-center border border-danger rounded">X No has ingresado un monto en particular, por favor reintenta.</p>`;
    }
    else{
        document.getElementById('validate').innerHTML = `<p class = " p-2 text-center border border-danger rounded">X No contas con dinero para hacer la transaccion</p>`;
    }
    let arsLoad = localStorage.setItem('billetera', wallet);
    let btcLoad = localStorage.setItem('cripto', btc);
    return;
}
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
    }
    let arsLoad = localStorage.setItem('billetera', wallet);
    let btcLoad = localStorage.setItem('cripto', btc);
    return;
}
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
        document.getElementById("wallet-sidebar").innerHTML = `<p>ARS$ ${wallet}  y BTC$ ${btc}  </p>`
    }
    
    else if(document.getElementById('amountIn').value = isNaN(amount)){
        document.getElementById('validate').innerHTML = `<p class = " p-2 text-center border border-danger rounded">X No has ingresado un monto en particular, por favor reintenta.</p>`;
    }
    else{
        document.getElementById('validate').innerHTML = `<p class = " p-2 text-center border border-danger rounded">X No es posible realizar la transaccion</p>`;
    }
    let arsLoad = localStorage.setItem('billetera', wallet);
    let btcLoad = localStorage.setItem('cripto', btc);
    return;
}
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
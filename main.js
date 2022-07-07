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
let wallet = 0;
let btc = 0;

document.getElementById("wallet").innerHTML = `<p>ARS$${wallet} y BTC${btc}</p>`

const cryptoTrade = () =>{ //la idea a futuro es meter API para sacar el valor diario del BTC para poder hacer la conversion

    amount = parseInt( document.getElementById('exchange').value);
    if(wallet >= 0 && amount <= wallet){
        wallet -= amount;
        btc += amount/3802620.70;
        alert(`Perfecto, compraste ${btc} en BTC`);
        document.getElementById("wallet").innerHTML = `<p>ARS$${wallet} y BTC${btc}</p>`;
    }
    else if(document.getElementById('amountIn').value = isNaN(amount)){
        document.getElementById('validate').innerHTML = `X No has ingresado un monto en particular, por favor reintenta.`;
    }
    else{
        document.getElementById('validate').innerHTML = 'X No pipi, no tenes platita para hacer esto';
    }
    return;
}
const moneyIn = document.getElementById('amountInBtn') 
moneyIn.onclick = () => { //funcion que ingresa dinero, como es infinito, sin problemas (por ahora, la idea es meter un href a mercadopago.)
    if(amount = parseInt( document.getElementById('amountIn').value)){
        wallet += amount;
        alert(`Felicitaciones, ingresaste ARS$${amount} cantidad de dinero`);
        document.getElementById("wallet").innerHTML = `<p>ARS$${wallet} y BTC${btc}</p>`;
    }
    else if(document.getElementById('amountIn').value = isNaN(amount)){
        document.getElementById('validate').innerHTML = `X No has ingresado un monto en particular, por favor reintenta.`;
    }
    return;
}

const moneyOut = () =>{ //funcion que saca dinero de input para actualizar wallet.
    amount = parseInt(document.getElementById('amountOut').value);
    if(wallet >= 0 && amount <= wallet){
        wallet -= amount;
        alert(`Felicitaciones, descontaste ARS$${amount} cantidad de dinero`);
        document.getElementById("wallet").innerHTML = `<p>ARS$${wallet} y BTC${btc}</p>`;
        }
        else if(document.getElementById('amountIn').value = isNaN(amount)){
            document.getElementById('validate').innerHTML = `X No has ingresado un monto en particular, por favor reintenta.`;
        }
        else{
            document.getElementById('validate').innerHTML = 'X no locura, vos queres endeudarte, no te lo voy a permitir!';
        }
    return;
}

//Local Storage, Saving All Transactions.
let arsLoad = localStorage.setItem('billetera', wallet);
let btcLoad = localStorage.setItem('cripto', btc);
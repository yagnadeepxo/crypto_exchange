
const express = require('express')
const mysql = require('mysql')
var bodyParser = require('body-parser')
const request = require('request');
const { sha256 } = require('js-sha256');
const app = express();

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.listen('3000',()=>{
    console.log("server up n listening")
})

app.set('view engine','ejs')
//creating a database connection

var db = mysql.createPool({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database:'cex',
    waitForConnections:true,
    connectionLimit:10,
    queueLimit:0,
    multipleStatements: true
  });

app.get('/',(req,res)=>{
    res.sendFile('home.html',{root:__dirname})
})

app.get('/login',(req,res)=>{
    res.sendFile('login.html',{root:__dirname})
})
var name='';
var price;
var dbinfo;
var f_btc_ava;
var f_usd_ava;
var f_iv_ava;
app.post('/login',(req,res)=>{
    var username = req.body.username;
    var password = req.body.password;
    let sql = "select * from user_info where username = ? and password = ?"
    db.query(sql,[username,password],(err,result)=>{
        if(err) throw err;
        if(result.length>0){
            dbinfo = result[0]
            name = dbinfo.username;
            let sql1 = "select * from portfolio where username = ?"
            db.query(sql1,[name],(err,result)=>{
                if(err) throw err;
                f_btc_ava=result[0].btc_count;
                f_usd_ava=result[0].usd_count;
                f_iv_ava=result[0].initial_val;
            })
            res.redirect('http://localhost:3000/dashboard')
        }
        else{
            res.send('you invalid')
        }
    })
})
var cryptodata;
request('https://api.blockchain.com/v3/exchange/tickers/BTC-USD', async (error, response, body) => {
    cryptodata = await JSON.parse(body);
     price = cryptodata.price_24h;
});

app.get('/dashboard',(req,res)=>{
    res.render('hello',{
        result:
        {
        name,
        price,
        f_btc_ava,
        f_usd_ava,
        f_iv_ava
    }
})
   
})


app.post('/',(req,res)=>{
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;
    
    let sql1 = "insert into user_info(username,email,password) values(? ,?, ?)"
    let sql2 = "insert into portfolio(username,btc_count,usd_count,initial_val) values(? ,?, ?,?)"
    db.query(sql1,[username,email,password],(err)=>{
        if(err) throw err;
        res.send('success')
    })
    db.query(sql2,[username,0,100000,0],(err)=>{
        if(err) throw err;
    })
})

app.get('/buy',(req,res)=>{
    res.sendFile('buy.html',{root:__dirname})
})

app.post('/buy',(req,res)=>{
    var btc_req = req.body.no_of_btc;
    var no_btc_req = parseFloat(btc_req)
    var usd_needed = price*btc_req;
    var trans_fee = usd_needed*(0.2/100);
    let sql = 'select btc_count,usd_count,initial_val from portfolio where username = ?'
    let usd_ava;
    let new_usd_count;
    let btc_ava;
    let new_btc_ava;
    let iv_ava;
    let new_iv;
    var date
    let time_stamp
    let ts
    let trans_hash;
    db.query(sql,[name],(err,result)=>{
        if(err) throw err;
        if(result.length>0){
            btc_ava=result[0].btc_count
            usd_ava=result[0].usd_count
            iv_ava = result[0].initial_val;
            
            if(usd_ava>=usd_needed){
                new_usd_count = usd_ava-usd_needed-trans_fee;
                new_btc_ava = no_btc_req+btc_ava;
                new_iv=iv_ava+usd_needed;
                let sql1 = 'update portfolio set btc_count=?,usd_count=?,initial_val=? where username=?'
                db.query(sql1,[new_btc_ava,new_usd_count,new_iv,name],(err)=>{
                    if(err) throw err;
                            db.getConnection((err,connection)=>{
                                date = new Date()
                                time_stamp = date.getTime()
                                ts=time_stamp.toString()
                                trans_hash=sha256(ts)
                                let sql2='insert into history(username,trade,trans_hash,volume_traded,time_stamp) values(?,?,?,?,?)'
                                connection.query(sql2,[name,'B',trans_hash,usd_needed,ts],(err,result)=>{
                                    if(err) throw err;
                                    else{
                                        let sql3 = 'insert into profit(trans_hash,trans_fee) values(?,?)'
                                        db.query(sql3,[trans_hash,trans_fee],(err)=>{
                                            if(err) throw err;
                                            else{
                                                res.send('successfully bought bitcoin')
                                            }
                                        })
                                    }
                                }) 
                                db.query('COMMIT');
                            })
                            
                        })
                        
                    }
            else{
                    res.send('no money')
                }
            }
    })
})


// sell functionality

app.get('/sell',(req,res)=>{
    res.sendFile('sell.html',{root:__dirname})
})

app.post('/sell',(req,res)=>{
    var btc_sell = req.body.no_of_btc;
    var no_btc_sell = parseFloat(btc_sell)
    var usd_sell = price*no_btc_sell;
    var trans_fee = (0.2/100)*usd_sell;
    let sql = 'select usd_count,btc_count,initial_val from portfolio where username = ?'
    let usd_ava;
    let btc_ava;
    let iv_ava;
    var date
    let time_stamp
    let ts
    let trans_hash;
    db.query(sql,[name],(err,result)=>{
        if(err) throw err;
        usd_ava=result[0].usd_count;
        btc_ava=result[0].btc_count;
        iv_ava = result[0].initial_val;
        let new_btc_ava = btc_ava-no_btc_sell;
        if(btc_ava>=btc_sell){
            let sql1 = 'update portfolio set btc_count=?,usd_count=?,initial_val=? where username=?'
            let new_usd_ava = usd_ava+usd_sell-trans_fee;
            let new_initial_val = iv_ava-usd_sell;
            db.query(sql1,[new_btc_ava,new_usd_ava,new_initial_val,name],(err)=>{
                if(err) throw err;
                db.getConnection((err,connection)=>{
                    date = new Date()
                    time_stamp = date.getTime()
                    ts=time_stamp.toString()
                    trans_hash=sha256(ts)
                    let sql2='insert into history(username,trade,trans_hash,volume_traded,time_stamp) values(?,?,?,?,?)'
                    connection.query(sql2,[name,'S',trans_hash,usd_sell,ts],(err,result)=>{
                        if(err) throw err;
                        else{
                            let sql3 = 'insert into profit(trans_hash,trans_fee) values(?,?)'
                            db.query(sql3,[trans_hash,trans_fee],(err)=>{
                                if(err) throw err;
                                else{
                                    res.send('successfully sold bitcoin')
                                }
                            })
                        }
                    }) 
                    db.query('COMMIT');
                })
            })
        }
        else{
            res.send("u dont have enough bitcoins")
        }
    })

})








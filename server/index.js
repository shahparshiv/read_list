const keys = require('./keys')
const express = require('express');
const redis = require('redis');
const cors = require('cors');
const bodyParser = require('body-parser');
const {Pool} = require('pg')
const axios = require('axios')
const secrets = require('./secrets')

const app=express();
app.use(cors());
app.use(bodyParser.json())

//Redis client 
const redisClient = redis.createClient({
    url: 'redis://default:default@redis:6379',
    family: 6,
    retry_strategy : () => 1000
});

(async()=>{
    redisClient.on('error',(err)=> console.log(err));

    await redisClient.connect();
})();

//Postgres Client
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
})
pgClient.on('error', ()=> console.log('lost PG connection'));

pgClient
    .query('CREATE TABLE IF NOT EXISTS searches (search_text VARCHAR)')
    .catch(err => console.log(err));

pgClient
    .query("CREATE TABLE IF NOT EXISTS book_list (date VARCHAR, title VARCHAR)" )

const books = ['ABC', 'XYZ']

app.get('/test',(req,res)=>{
    res.send("Hi")
});

const getBookDetails = async (searchKey) => {
    bookAPI = 'https://api.nytimes.com/svc/books/v3'
    api_key = secrets.bookAPIKEY
    searchKey = searchKey.split(' ').join('+')
    console.log(bookAPI+'/reviews.json?title='+searchKey+'&api-key='+api_key);
    const bookDetails = await axios.get(bookAPI+'/reviews.json?title='+searchKey+'&api-key='+api_key)
                             .catch(err =>console.log(err));
    console.log(bookDetails.data.results);
    return bookDetails;
}

app.post('/search',async(req,res)=>{
    const searchKey = req.body.searchKey
    console.log(searchKey);
    books.push(searchKey);
    console.log(books);

    const bookDetails = await getBookDetails(searchKey);

    await redisClient.SADD('values',searchKey);
    pgClient.query('INSERT INTO searches(search_text) VALUES($1)',[searchKey])
    console.log('write successful');
    console.log(await redisClient.SMEMBERS('values'));
    // res.send(await redisClient.SMEMBERS('values'));
    res.send(bookDetails.data);
});

app.get('/search/values',async (req,res)=>{
    console.log("API call successful");
    const searchList = await pgClient.query('SELECT * FROM searches')
    console.log(searchList.rows);
    res.send(searchList.rows)
})

app.post('/book', async(req,res)=>{
    console.log(req.body);
    const bookTitle = req.body.title
    const date = req.body.date

    await pgClient.query('INSERT INTO book_list(date, title) VALUES($1, $2)',[date, bookTitle])

    res.send('Added to Read List')

    const updtList = await pgClient.query('SELECT * FROM book_list')
    console.log(updtList.rows);
})


app.listen(5000,err=>{
    console.log("Listening");
});
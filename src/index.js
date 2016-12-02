import express from 'express';
import cors from 'cors';
import _ from 'lodash';
import fs from 'fs';
import Promise from 'bluebird';
require('es6-promise').polyfill();
require('isomorphic-fetch');

const app = express();
app.use(cors());

const BaseURL = 'https://pokeapi.co/api/v2';
const PokemonsUrl=`${BaseURL}/pokemon`;
const FilePokemons = __dirname+'/data/Pokemons.json';
const FilePages  = __dirname+'/data/PokemonPages.json';
const __RETRY_sec__=20;

async function getAllPokemons( url ){
  let retryAfter = __RETRY_sec__;
  const doRequest = async () => {
    try{
      console.log('All pages url', url);
      const res = await fetch(url);
      if (res.status > 400) {
        retryAfter=parseInt(res.headers.get('retry-after'));
        retryAfter = retryAfter? retryAfter : __RETRY_sec__;
        throw new Error(`Bad response. Status=${res.status} and retry-after=${res.headers.get('retry-after')}`);
      }
      const page = await res.json();
      const pokemons = page.results;
      if( page.next ){
        const pokemons2 = await getAllPokemons( page.next+'&limit='+page.count );
        return [ ...pokemons, ...pokemons2];
      }
      return pokemons;
    }catch (error){
      console.error(error.message,'=====>>>>',`Expected available in ${retryAfter}sec from ${url}`);
      setTimeout(doRequest, retryAfter*1000 );
    }
  }
  return doRequest();
}

async function getPokemon( url ){
  let retryAfter = __RETRY_sec__;
  const doRequest = async () => {
    try {
      console.log('Loading pokemon from ', url);
      let res = await fetch(url);
      // retry-after:278, status:429
      if (res.status > 400) {
        retryAfter=parseInt(res.headers.get('retry-after'));
        retryAfter = retryAfter? retryAfter : __RETRY_sec__;
        throw new Error(`Bad response. Status=${res.status} and retry-after=${res.headers.get('retry-after')}`);
      }
      let data = await res.json();
      let pokemon = {id: data.id, height: data.height, weight: data.weight, name: data.name};
      console.log('>>>>>>>>>> Get pokemon', pokemon);
      return pokemon;
    }catch (error){
      console.error(error.message,'=====>>>>',`Expected available in ${retryAfter}sec from ${url}`);
      setTimeout(doRequest, retryAfter*1000);
    }
  }
  return doRequest();
}

let Pokemons=[];

app.get('/:metrica?', async (req, res, next) => {
  //limit & offset query params
  let limit = req.query.limit || 20,
      offset = req.query.offset || 0,
      answer = [];

  switch (req.params.metrica) {
    case 'angular':
        answer = _.orderBy(Pokemons, [(p)=>{return p.weight / p.height}], ['ask', 'ask']);
      break;
    case 'fat':
        answer = _.orderBy(Pokemons, [(p)=>{return p.weight / p.height}], ['desc', 'ask']);
        break;
    case 'heavy':
        answer = _.orderBy(Pokemons,["weight", "name"], ["desc", "asc"]);
        break;
    case 'light':
        answer = _.orderBy(Pokemons,["weight", "name"], ["asc", "asc"]);
        break;
    case 'huge':
      answer = _.orderBy(Pokemons,["height", "name"], ["desc", "asc"]);
      break;
    case 'micro':
      answer = _.orderBy(Pokemons,["height", "name"], ["asc", "asc"]);
      break;
    case undefined:
      answer = _.sortBy(Pokemons,'name');
      break;
    default:
      return res.status(404).send("Not Found");
  }
  res.json( answer.slice(offset, (+offset + +limit)).map( (p)=>{return p.name} ) );
});

app.listen(3000, async () => {
  //Preload data pokemon's pages
  let Pages;
  try {
    Pages=JSON.parse(fs.readFileSync(FilePages));
    console.log(`Read from file ${FilePages}\nFound ${Object.keys(Pages).length} pages`);
  } catch (e) {
    console.log(`${e}\nCan't read from file ${FilePages}!\n`);
  }

  if(Object.keys(Pages).length == 0){
    Pages = await getAllPokemons(PokemonsUrl);
    fs.writeFileSync(FilePages, JSON.stringify(Pages));
    console.log(`Write to cache file ${FilePages}`);
  }

  //Preload data pokemons
  try {
    Pokemons=JSON.parse(fs.readFileSync(FilePokemons));
    console.log(`Read from file ${FilePokemons}\nFound ${Object.keys(Pokemons).length} pokemons`);
  } catch (e) {
    console.log(`${e}\nCan't read from file ${FilePokemons}!\n`);
  }

  if(Object.keys(Pokemons).length < Object.keys(Pages).length){
    console.log('Load from API pokemons');
    let pokemom;
    for(let i=0, c=Object.keys(Pages).length; i<c; i++){
      pokemom = await getPokemon(Pages[i].url);
      Pokemons.push(pokemom);
    }

    fs.writeFileSync(FilePokemons, JSON.stringify(Pokemons));
     console.log(`Write to cache file ${FilePokemons}\nFound ${Object.keys(Pokemons).length} pokemons`);
  }
  console.log('>>>>> Your app listening on port 3000 <<<<<<');
});

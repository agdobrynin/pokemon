var express = require('express');
require('es6-promise').polyfill();
require('isomorphic-fetch');
var Promise = require('bluebird');
var _ = require('lodash');

var app = express();

const __DEV__ = true;
const __DEV_MAX_COUNT_POKEMONS__ =5;

const BaseURL = 'https://pokeapi.co/api/v2';
const PokemonsUrl=`${BaseURL}/pokemon`;
const PokemonFields = ['id', 'name', 'weight'];
/**
 * [getAllPokemons description]
 * @param  {[type]}  url   [description]
 * @param  {Number}  [i=0] [description]
 * @return {Promise}       [description]
 */
async function getAllPokemons( url, i=0 ){

  const response = await fetch(url);
  const page = await response.json();
  const pokemons = page.results;
  if( __DEV__ && i>3){
    return pokemons;
  }
  if( page.next ){
    const pokemons2 = await getAllPokemons( page.next, i +1 );
    return [
      ...pokemons,
      ...pokemons2
    ]
  }
  return pokemons;
}
/**
 * [getAllPokemon description]
 * @param  {[type]}  id [description]
 * @return {Promise}    [description]
 */
async function getPokemon( url ){
  const response = await fetch(url);
  const pokemon = await response.json();
  return pokemon;
}

// index page
app.get('/', async (req, res) => {
  try{
    const PokemonsInfo = await getAllPokemons(PokemonsUrl);
    const PokemonsPromises = PokemonsInfo.slice(0, __DEV__?__DEV_MAX_COUNT_POKEMONS__:PokemonsInfo.length).map(info => {
      return getPokemon(info.url);
    });

    const PokemonsFull = await Promise.all(PokemonsPromises);
    const pokemons = PokemonsFull.map( (pokemon) => {
      return _.pick(pokemon, PokemonFields);
    });

    const SortPokemons = _.sortBy(pokemons, pokemon => -pokemon.weight);

    return res.json(SortPokemons);

  }catch(err){
    console.log(err);
    return res.json({ err });
  }
});

app.listen(3000, () => {
  console.log('Your app listening on port 3000 ...');
});

/// make function, usefull to make object literals from arrow functions
/// otherwise you have to wrap your literal in { return <obj> } 
export function make<T>(v:T) { return v }
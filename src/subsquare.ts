import fetch from "node-fetch";

export class SubsquareApi{
    private readonly url:string;
    constructor(){
        this.url = "https://collectives.subsquare.io";
    }

    async fetchReferenda(index:number):Promise<any>{
        const request = await fetch(`${this.url}/api/fellowship/referenda/${index}.json`);
        return await request.json();
    }
}

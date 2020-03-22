import { Mesh } from 'webgl-obj-loader';


export async function load(filename: string): Promise<Mesh> {
    const results = await fetch(filename);
    return new Mesh(await results.text());
}

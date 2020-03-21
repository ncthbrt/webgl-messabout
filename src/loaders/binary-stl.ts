function parse(data: ArrayBuffer): ModelData {
    let reader = new DataView(data);
    let faces = reader.getUint32(80, true);

    let r: number = 0;
    let g: number = 0;
    let b: number = 0;
    let hasColors = false;
    let defaultR: number = 0;
    let defaultG: number = 0;
    let defaultB: number = 0;
    let alpha: number = 0;

    let colors: Float32Array | null = null;

    // process STL header
    // check for default color in header ("COLOR=rgba" sequence).

    for (let index = 0; index < 80 - 10; index++) {

        if ((reader.getUint32(index, false) == 0x434F4C4F /*COLO*/) &&
            (reader.getUint8(index + 4) == 0x52 /*'R'*/) &&
            (reader.getUint8(index + 5) == 0x3D /*'='*/)) {

            hasColors = true;
            colors = new Float32Array(faces * 3 * 3);

            defaultR = reader.getUint8(index + 6) / 255;
            defaultG = reader.getUint8(index + 7) / 255;
            defaultB = reader.getUint8(index + 8) / 255;
            alpha = reader.getUint8(index + 9) / 255;

        }
    }

    let dataOffset = 84;
    let faceLength = 12 * 4 + 2;


    let vertices = new Float32Array(faces * 3 * 3);
    let normals = new Float32Array(faces * 3 * 3);

    for (let face = 0; face < faces; face++) {

        let start = dataOffset + face * faceLength;
        let normalX = reader.getFloat32(start, true);
        let normalY = reader.getFloat32(start + 4, true);
        let normalZ = reader.getFloat32(start + 8, true);

        if (colors) {

            let packedColor = reader.getUint16(start + 48, true);

            if ((packedColor & 0x8000) === 0) {

                // facet has its own unique color

                r = (packedColor & 0x1F) / 31;
                g = ((packedColor >> 5) & 0x1F) / 31;
                b = ((packedColor >> 10) & 0x1F) / 31;

            } else {

                r = defaultR;
                g = defaultG;
                b = defaultB;

            }

        }

        for (let i = 1; i <= 3; i++) {

            let vertexstart = start + i * 12;
            let componentIdx = (face * 3 * 3) + ((i - 1) * 3);

            vertices[componentIdx] = reader.getFloat32(vertexstart, true);
            vertices[componentIdx + 1] = reader.getFloat32(vertexstart + 4, true);
            vertices[componentIdx + 2] = reader.getFloat32(vertexstart + 8, true);

            normals[componentIdx] = normalX;
            normals[componentIdx + 1] = normalY;
            normals[componentIdx + 2] = normalZ;

            if (colors) {
                colors[componentIdx] = r;
                colors[componentIdx + 1] = g;
                colors[componentIdx + 2] = b;
            }

        }
    }

    return {
        hasColors,
        position: vertices,
        normals: normals,
        ...(hasColors && colors ? { alpha, colors } : {})
    }
}


export async function load(filename: string): Promise<ModelData> {
    const results = await fetch(filename);
    const buffer = await results.arrayBuffer();
    return parse(buffer);
}


export type ModelData = {
    hasColors: boolean,
    position: Float32Array,
    normals: Float32Array,
    colors?: Float32Array,
    alpha?: number
}
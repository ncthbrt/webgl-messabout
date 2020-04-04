import * as React from 'preact/compat';
import { Mesh, MeshWithBuffers, initMeshBuffers, ExtendedGLBuffer } from 'webgl-obj-loader';
import { assertTrue } from '../util/safety';
import vert from '../shaders/phong.vert';
import frag from '../shaders/phong.frag';
import { mat4 } from 'gl-matrix';
import { useEffect } from 'react';
import Box from '../stitch_icons/Box.obj';

type ProgramInfo = {
    vertexPositionAttribute: number,
    vertexNormalAttribute: number,
    textureCoordAttribute: number,
    uniformLocations: {
        projectionMatrix: WebGLUniformLocation,
        modelViewMatrix: WebGLUniformLocation,
        vertexColor: WebGLUniformLocation,
        normalMatrix: WebGLUniformLocation
    }
};

function compileShader(gl: WebGLRenderingContext, type: GLenum, source: string) {
    const shader: WebGLShader | null = gl.createShader(type);
    assertTrue(shader);
    // Send the source to the shader object

    gl.shaderSource(shader, source);

    // Compile the shader program

    gl.compileShader(shader);

    // See if it compiled successfully

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        throw new Error('Error');
    }

    return shader;
}


function throwIfNotDefined<T>(value: T | undefined | null): T {
    if (!value) {
        throw new Error("Assertion failure");
    }
    return value;
}

function bindBuffer(target: number, attribute: number, extended: ExtendedGLBuffer, gl: WebGLRenderingContext) {
    gl.bindBuffer(target, extended);
    gl.vertexAttribPointer(attribute, extended.itemSize, gl.FLOAT, false, 0, 0);
}

function compileAndLinkProgram(gl: WebGLRenderingContext): WebGLProgram & ProgramInfo {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vert);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, frag);
    const shaderProgram: WebGLProgram | null = gl.createProgram();

    assertTrue(shaderProgram);
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    const programWithUniforms = (shaderProgram as ProgramInfo & WebGLProgram);
    programWithUniforms.uniformLocations = {
        projectionMatrix: throwIfNotDefined(gl.getUniformLocation(shaderProgram, 'uProjectionMatrix')),
        modelViewMatrix: throwIfNotDefined(gl.getUniformLocation(shaderProgram, 'uModelViewMatrix')),
        vertexColor: throwIfNotDefined(gl.getUniformLocation(shaderProgram, 'uVertexColor')),
        normalMatrix: throwIfNotDefined(gl.getUniformLocation(shaderProgram, 'uNormalMatrix'))
    };

    programWithUniforms.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(programWithUniforms.vertexPositionAttribute);

    programWithUniforms.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(programWithUniforms.vertexNormalAttribute);

    programWithUniforms.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(programWithUniforms.textureCoordAttribute);

    return programWithUniforms;
}

type MeshWithBuffersAndTransform = MeshWithBuffers & {
    transform: mat4,
    transformedNormal: mat4
};

function loadMesh(meshContents: string, gl: WebGLRenderingContext): MeshWithBuffersAndTransform {
    const mesh = new Mesh(meshContents);
    const withBuffers = initMeshBuffers(gl, mesh);
    return Object.assign(withBuffers, {
        transform: mat4.create(),
        transformedNormal: mat4.create()
    });
}


function drawMesh(mesh: MeshWithBuffersAndTransform, gl: WebGLRenderingContext, program: WebGLProgram & ProgramInfo) {
    gl.uniformMatrix4fv(
        program.uniformLocations.modelViewMatrix,
        false,
        mesh.transform
    );

    mat4.invert(mesh.transformedNormal, mesh.transform);
    mat4.transpose(mesh.transformedNormal, mesh.transformedNormal);

    gl.uniformMatrix4fv(
        program.uniformLocations.normalMatrix,
        false,
        mesh.transformedNormal
    );

    if (!mesh.textures.length) {
        gl.disableVertexAttribArray(program.textureCoordAttribute);
    }
    else {
        // if the texture vertexAttribArray has been previously
        // disabled, then it needs to be re-enabled
        gl.enableVertexAttribArray(program.textureCoordAttribute);
        bindBuffer(gl.ARRAY_BUFFER, program.textureCoordAttribute, mesh.textureBuffer, gl);
    }

    bindBuffer(gl.ARRAY_BUFFER, program.vertexPositionAttribute, mesh.vertexBuffer, gl);
    bindBuffer(gl.ARRAY_BUFFER, program.vertexNormalAttribute, mesh.normalBuffer, gl);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    gl.drawElements(gl.TRIANGLES, mesh.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}

export function ThreeDLoader() {
    const ref = React.useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        if (ref.current) {
            const gl = ref.current.getContext('webgl');
            if (!gl) {
                console.error('WebGL context unavailable');
                return;
            }
            // Clear the canvas before we start drawing on it.
            gl.clearColor(0.0, 0.0, 0.0, 0.0);  // Clear to transparent, fully opaque
            gl.clearDepth(1.0);                 // Clear everything
            gl.enable(gl.DEPTH_TEST);           // Enable depth testing
            gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

            const program = compileAndLinkProgram(gl);
            const mesh = loadMesh(Box, gl);

            // Create a perspective matrix, a special matrix that is
            // used to simulate the distortion of perspective in a camera.
            // Our field of view is 45 degrees, with a width/height
            // ratio that matches the display size of the canvas
            // and we only want to see objects between 0.1 units
            // and 100 units away from the camera.

            const fieldOfView = 60 * Math.PI / 180;   // in radians
            const aspect = gl.canvas.width / gl.canvas.height;
            const zNear = 0.1;
            const zFar = 100.0;
            const projectionMatrix = mat4.create();

            // note: glmatrix.js always has the first argument
            // as the destination to receive the result.
            mat4.perspective(projectionMatrix,
                fieldOfView,
                aspect,
                zNear,
                zFar);


            // Now move the drawing position a bit to where we want to
            // start drawing the object.

            mat4.translate(mesh.transform,     // destination matrix
                mesh.transform,     // matrix to translate
                [-0.0, 0.0, -6.0]);  // amount to translate
            mat4.rotateX(mesh.transform, mesh.transform, (-45 / 180.0) * Math.PI);

            mat4.invert(mesh.transformedNormal, mesh.transform);
            mat4.transpose(mesh.transformedNormal, mesh.transformedNormal);

            // Tell WebGL to use our program when drawing
            gl.useProgram(program);

            // Set the shader uniforms
            gl.uniformMatrix4fv(
                program.uniformLocations.projectionMatrix,
                false,
                projectionMatrix);
            gl.uniformMatrix4fv(
                program.uniformLocations.modelViewMatrix,
                false,
                mesh.transform);
            gl.uniform4f(program.uniformLocations.vertexColor, 1.0, 1.0, 1.0, 1.0);


            let time = Date.now() * 0.001;
            const draw = (now: number) => {
                now *= 0.001;  // convert to seconds
                const deltaTime = (now - time);
                time = now;

                // Update state
                mat4.rotate(mesh.transform,  // destination matrix
                    mesh.transform,  // matrix to rotate
                    deltaTime * 1.6,
                    [1, 1, 0]
                );

                // Start drawing
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                drawMesh(mesh, gl, program);

                if (ref.current) {
                    requestAnimationFrame(draw);
                }
            }
            requestAnimationFrame(draw);
        }
    }, [ref.current]);

    useEffect(() => {
        return (() => {
            ref.current = null;
        });
    }, []);

    const size = React.useMemo(() => (window.screen.width * 0.25) | 0, [window.screen.width]);
    return <div className='has-text-centered'><canvas width={size} height={size} ref={ref} /></div>;
}
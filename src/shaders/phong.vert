attribute vec4 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

uniform mat4 uNormalMatrix;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

uniform vec4 uVertexColor;

varying lowp vec4 vColor;
varying highp vec4 vNormal;
varying highp vec2 uv;

varying highp vec3 vPosition;

void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    vColor = uVertexColor;

    highp vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 1.0);    
    vNormal = transformedNormal;
    vPosition = gl_Position.xyz;
    uv = aTextureCoord;
}

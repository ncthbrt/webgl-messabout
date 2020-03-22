varying lowp vec4 vColor;
varying highp vec4 vNormal;
varying highp vec2 uv;

void main() {
    highp vec3 ambientLight = vec3(0.55, 0.55, 0.55);
    highp vec3 directionalLightColor = vec3(1, 1, 1);
    highp vec3 directionalVector = normalize(vec3(0.85, 0.8, 0.75));

    highp float directional = max(dot(vNormal.xyz, directionalVector), 0.0);
    highp vec3 lighting = ambientLight + (directionalLightColor * directional);

    gl_FragColor = vec4(vColor.rgb * lighting, vColor.a);
}

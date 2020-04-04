varying lowp vec4 vColor;
varying highp vec4 vNormal;
varying highp vec3 vPosition;
varying highp vec2 uv;

uniform highp mat4 uProjectionMatrix;

highp vec3 DirectIllumination(highp vec3 P, highp vec3 N, highp vec3 lightCentre, highp float lightRadius, highp vec3 lightColour, highp float cutoff)
{
    // calculate normalized light vector and distance to sphere light surface
    highp float r = lightRadius;
    highp vec3 L = lightCentre - P;
    highp float distance = length(L);
    highp float d = max(distance - r, 0.0);
    L = L / distance;
     
    // calculate basic attenuation
    highp float denom = d/r + 1.0;
    highp float attenuation = 1.0 / (denom*denom);
     
    // scale and bias attenuation such that:
    //   attenuation == 0 at extent of max influence
    //   attenuation == 1 when d == 0
    attenuation = (attenuation - cutoff) / (1.0 - cutoff);
    attenuation = max(attenuation, 0.0);    
    highp float dot = max(dot(L.xyz, N.xyz), 0.0);
    return lightColour * (dot * attenuation);
}

void main() {
    highp vec3 ambientLight = vec3(0.6, 0.6, 0.6);

    highp vec3 pointLightPosition = (uProjectionMatrix * vec4(-5, 8,-7.0, 0)).xyz;
    highp vec3 pointLightColor = vec3(1, 0.9, 0.9);    
    highp vec3 pointLighting = DirectIllumination(vPosition, vNormal.xyz, pointLightPosition, 10.0, pointLightColor,  0.01);
    
    highp vec3 directionalVector = normalize(vec3(0.85, 0.8, 0.75));    
    highp float directional = max(dot(vNormal.xyz, directionalVector), 0.0);
    highp vec3 directionalLightColor = vec3(0.85, 0.8, 0.8);    
    highp vec3 directionalLighting = (directionalLightColor * directional);

    gl_FragColor = vec4(vColor.rgb * (ambientLight + pointLighting + directionalLighting) , vColor.a);
}

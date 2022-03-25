import * as THREE from "./lib/three.module.js";
import { GLTFLoader } from "./lib/GLTFLoader.js";
import { RoomEnvironment } from "./lib/RoomEnvironment.js";
import { OrbitControls } from "./lib/OrbitControls.js";

// 0 main page
// 1 Product list page
// 2 Product detail page

export class Viewer3D {
  constructor(callback, canvasId) {
    this.container = document.getElementById(canvasId);
    this.currentColor = { r: 1, g: 0, b: 0 };
    this.lampOffColor = { r: 0.5, g: 0.5, b: 0.5 };
    this.isEngineStart = false;
    this.audio = new Audio();

    this.modelName = "";

    this.camera = new THREE.PerspectiveCamera(
      30,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      3000
    );

    //Store required callbacks
    this.rotateCompleteCallback = callback.rotateComplete;
    this.modelLoadCompleteCallback = callback.modelLoadComplete;
    this.tiltCallback = callback.tiltComplete;

    this.scene = new THREE.Scene();
    this.model = new THREE.Scene();
    this.scene.add(this.model);

    this.originalCameraPosition = new THREE.Vector3();
    this.renderer;
    this.controls;
    this.mouseX = 0;
    this.mouseY = 0;
    this.allowScrollTilt = false;
    this.sceneCenter = new THREE.Vector3();
    this.isMousePresentInDocument = false;
    this.isMousePresentInCanvas = false;
    this.modelSpreadOnLoad = true;
    this.gapBetweenModels = 8.5;
    this.enableTiltOnHover = false;
    this.scrollValue = window.scrollY;
    this.rotate360 = false;
    this.enableTiltAndRotateOnMove = false;
    this.isTiltAnimationComplete = true;
    this.cameraZ = 2000;
    this.modelCenter = new THREE.Vector3(0, 0, 0);
    window.addEventListener("scroll", (event) => {
      this.manipulateCameraHeight(window.scrollY);
    });
    this.containerHalfX = this.container.clientWidth / 2;
    this.containerHalfY = this.container.clientHeight / 2;

    this.camera.position.copy(new THREE.Vector3(0, 0.0, this.cameraZ));
    this.camera.lookAt(this.modelCenter);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.listenToKeyEvents(window); // optional

    //controls.addEventListener( 'change', render ); // call this only in static scenes (i.e., if there is no animation loop)

    this.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    this.controls.dampingFactor = 0.05;

    this.controls.screenSpacePanning = false;

    this.controls.minDistance = 0;
    this.controls.maxDistance = 5000;

    this.controls.maxPolarAngle = Math.PI / 2;

    this.renderer.setPixelRatio(1);

    this.renderer.setPixelRatio(2.5);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.container.appendChild(this.renderer.domElement);

    const environment = new RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(environment).texture;

    window.addEventListener("resize", this.onWindowResize.bind(this));
    document.addEventListener("mousemove", this.onDocumentMouseMove.bind(this));

    document.addEventListener(
      "mouseenter",
      this.onDocumentMouseEnter.bind(this)
    );
    document.addEventListener(
      "mouseleave",
      this.onDocumentMouseLeave.bind(this)
    );

    this.animate();
  }

  onWindowResize() {
    this.containerHalfX = this.container.clientWidth / 2;
    this.containerHalfY = this.container.clientHeight / 2;

    this.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
  }

  onDocumentMouseEnter() {
    this.isMousePresentInDocument = true;
    // if (this.enableTiltOnHover) this.tiltModel();
  }

  onDocumentMouseLeave() {
    this.isMousePresentInDocument = false;
    this.isMousePresentInCanvas = false;
    if (this.enableTiltOnHover) this.tiltModel();
  }

  onDocumentMouseMove(event) {
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;

    if (
      event.clientX <= this.container.clientWidth &&
      event.clientX >= this.container.offsetLeft
    ) {
      if (event.clientY <= this.container.clientHeight - this.scrollValue) {
        this.isMousePresentInCanvas = true;
        if (this.enableTiltOnHover) this.tiltModel();
      } else {
        this.isMousePresentInCanvas = false;
        if (this.enableTiltOnHover) this.tiltModel();
      }
    } else {
      this.isMousePresentInCanvas = false;
      if (this.enableTiltOnHover) this.tiltModel();
    }
  }

  showMultiModelSplit(flag = true) {
    let xPosition = [0.05, 0, -0.05, -0.1, -0.15];
    let zPosition = [0.05, 0, 0.05, 0.1, 0.15];

    if (!flag) {
      xPosition = [0, 0, 0, 0, 0];
      zPosition = [0, 0, 0, 0, 0];
    }
    let rotateInterval = [];
    this.scene.children.forEach((child, index) => {
      child.position.z = child.position.z + zPosition[index];

      rotateInterval[index] = setInterval(function () {
        if (xPosition[index] >= 0) {
          if (child.position.x <= xPosition[index]) {
            child.position.x = child.position.x + 0.002;
          }

          if (child.position.x >= xPosition[index]) {
            clearInterval(rotateInterval[index]);
          }
        } else {
          if (child.position.x >= xPosition[index]) {
            child.position.x = child.position.x - 0.002;
          }

          if (child.position.x <= xPosition[index]) {
            clearInterval(rotateInterval[index]);
          }
        }
      }, 0.25);
    });
  }

  manipulateCameraHeight(number) {
    this.scrollValue = number;
  }

  async start() {
    if (this.modelName === "") return;
    if (this.isEngineStart) {
      this.stop();
      return;
    }

    this.audio = new Audio("./Catlog/" + this.modelName + ".mp3");
    this.audio.loop = true;
    await this.audio.play();

    this.switchLight(this.scene);
    this.isEngineStart = true;
  }

  async stop() {
    if (!this.isEngineStart) return;

    this.audio.pause();
    viewer3D.lampOffColor = { r: 0.5, g: 0.5, b: 0.5 };
    viewer3D.isEngineStart = false;

    viewer3D.scene.children.forEach((child) => {
      if (child.uuid === "headLamp") {
        viewer3D.scene.remove(child);
      }
    });
  }

  /**
   * Use this function to enable disable tilt when mouse enters or leaves the screen.
   * @param  {} flag
   */
  allowTilt(flag) {
    this.enableTiltOnHover = flag;
    this.scene.rotation.x = 0;
  }

  /**
   * Use this function to enable disable tilt and rotate when mouse moves in screen.
   * @param  {} flag
   */
  allowRotateAndTilt(flag) {
    this.enableTiltAndRotateOnMove = flag;
    this.scene.rotation.x = 0;
    this.scene.rotation.y = 0;
  }

  /* Recursive function to Traverse the Scene-> Find mesh -> get material-> update the material color to new color */
  updateObject3DColor(object3d, color) {
    if (object3d) {
      let childrenLength = object3d.children.length;
      if (childrenLength > 0) {
        for (let i = 0; i < childrenLength; i++) {
          this.updateObject3DColor(object3d.children[i], color);
        }
        return;
      } else {
        if (object3d.material) {
          if (
            object3d.material.color.r - this.currentColor.r < 0.01 &&
            object3d.material.color.g - this.currentColor.g < 0.01 &&
            object3d.material.color.b - this.currentColor.b < 0.01
          ) {
            object3d.material.color.r = color.r;
            object3d.material.color.g = color.g;
            object3d.material.color.b = color.b;
          }
        }
      }
    }
  }

  /* Recursive function to Traverse the Scene-> Find mesh -> get material-> update the material color of lamp to new color white and add point light for better effect */
  switchLight(object3d) {
    if (object3d) {
      let childrenLength = object3d.children.length;
      if (childrenLength > 0) {
        for (let i = 0; i < childrenLength; i++) {
          this.switchLight(object3d.children[i]);
        }
        return;
      } else {
        if (object3d.material) {
          var currentLampColor = this.lampOffColor;
          if (
            object3d.material.color.r === currentLampColor.r &&
            object3d.material.color.g === currentLampColor.g &&
            object3d.material.color.b === currentLampColor.b
          ) {
            var spotLight = new THREE.PointLight(0xffff00, 100);
            spotLight.angle = Math.PI / 3;
            spotLight.penumbra = 0.1;
            spotLight.decay = 3;
            // chopper is marge in size so lamp should be large
            spotLight.distance =
              this.modelName === "chopper"
                ? 500
                : this.modelName === "motorcycle"
                ? 1
                : 1;

            spotLight.uuid = "headLamp";
            spotLight.castShadow = true;
            spotLight.shadow.mapSize.width = 512;
            spotLight.shadow.mapSize.height = 512;
            spotLight.shadow.camera.near = 10;
            spotLight.shadow.camera.far = 200;
            spotLight.shadow.focus = 1;

            var position = new THREE.Vector3();
            object3d.getWorldPosition(position);
            var box = new THREE.Box3().setFromObject(object3d);
            var center = new THREE.Vector3();
            box.getCenter(center);
            center.z = box.min.z - 0.25;
            // center.y = box.max.y;
            spotLight.position.copy(center);
            this.scene.add(spotLight);

            // const spotLightHelper = new THREE.PointLightHelper(spotLight);
            // this.scene.add(spotLightHelper);
          }
        }
      }
    }
  }

  updateModelColor(color) {
    this.updateObject3DColor(this.scene, color);
    this.currentColor = color;
  }

  setIsoView() {
    var camera = this.camera;
    var signals = this.signals;
    let box = new THREE.Box3().setFromObject(this.scene);
    if (box === undefined) {
      return;
    }

    var center = new THREE.Vector3();
    box.getCenter(center);
    if (center === undefined) {
      return;
    }

    this.controls.reset();
    this.controls.target.copy(center);
    var distance = box.min.distanceTo(box.max) * 1.5;

    var dirVec = new THREE.Vector3(1, 1, -1);
    var position = center.clone();
    position.addScaledVector(dirVec.normalize(), distance * 1.2);
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }

  tiltModel() {
    const timeInterval = 20;
    const cameraChange = 0.015;
    const tiltMax = -0.3;
    const tiltMin = 0;

    if (this.isTiltAnimationComplete) {
      let interval = setInterval(
        function () {
          if (this.isMousePresentInCanvas) {
            this.scene.rotation.x = this.scene.rotation.x - cameraChange;
            if (this.scene.rotation.x <= tiltMax) {
              this.isTiltAnimationComplete = true;
              clearInterval(interval);
              this.tiltCallback("front");
            }
          } else {
            this.scene.rotation.x = this.scene.rotation.x + cameraChange;
            if (this.scene.rotation.x >= tiltMin) {
              this.isTiltAnimationComplete = true;
              clearInterval(interval);
              this.tiltCallback("back");
            }
          }
        }.bind(this),
        timeInterval
      );

      this.isTiltAnimationComplete = false;
    }
  }

  // Private function dont call it from outside
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

const gLTFLoader = new GLTFLoader();
const modelPath = "Catlog/";
/**
 * Use this function to load the gltf model in viewer
 * @param  {} viewer3D provide valid object of viewer3D
 * @param  {} modelName provide model file name in directory
 */
export function loadModel(viewer3D, modelName) {
  viewer3D.audio.pause();
  gLTFLoader.load(modelPath + modelName + ".glb", function (gltf) {
    viewer3D.model.children = [];
    viewer3D.model.add(gltf.scene);

    let box = new THREE.Box3().setFromObject(viewer3D.scene);
    let center = new THREE.Vector3();
    box.getCenter(center);
    viewer3D.sceneCenter.copy(center);
    viewer3D.setIsoView();
    viewer3D.modelName = modelName;
    viewer3D.currentColor = { r: 1, g: 0, b: 0 };
    viewer3D.lampOffColor = { r: 0.5, g: 0.5, b: 0.5 };
    viewer3D.isEngineStart = false;

    viewer3D.scene.children.forEach((child) => {
      if (child.uuid === "headLamp") {
        viewer3D.scene.remove(child);
      }
    });
    viewer3D.modelLoadCompleteCallback();
  });
}

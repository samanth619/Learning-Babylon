// import * as BABYLON from "@babylonjs/core";
// import earcut from "earcut";

let drawButton = document.getElementById("drawButton");
let extrudeButton = document.getElementById("extrudeButton");
let moveButton = document.getElementById("moveButton");
let resizeButton = document.getElementById("resizeButton");
let undoButton = document.getElementById("undoButton");
let redoButton = document.getElementById("redoButton");
let mode = document.getElementById("mode");

class PlayGround {
  constructor() {
    this.canvas = document.getElementById("renderCanvas");
    this.engine = new BABYLON.Engine(this.canvas, true);
    this.scene = null;
    this.camera = null;
    this.ground = null;
    this.drawMode = false; //to track drawing status
    this.moveMode = false; //to track moving objects status
    this.resizeMode = false; //to track resizing objects status
    this.currentShape = []; //to store pointts selected using left click and right click
    this.lines = [];
    this.currentPolygon = null;
    this.allPolygons = [];
    this.pickableMeshes = [];
    this.selectedMesh = null;
    this.previousMeshMaterial = null;
    this.selectedMat = null; //material to highlight selected mesh as an indication of selection
    this.defaultMat = null;
    this.redoStack = []; //to store points that are removed using undo
    this.init();
  }

  init() {
    drawButton.addEventListener("click", (event) => {
      this.drawMode = !this.drawMode;
      if (this.drawMode) {
        document.getElementById("extrudeButton").style.display = "block";
        mode.innerText = "Drawing";
      } else {
        this.stopDrawing();
      }
    });

    extrudeButton.addEventListener("click", (event) => {
      if (this.currentPolygon && this.currentShape.length > 2) {
        this.extrudeShape();
      }
    });

    moveButton.addEventListener("click", () => {
      this.moveMode = !this.moveMode;
      this.handleMoveMode();
      if (this.moveMode) {
        //mode.innerText = "Moving";
        this.stopDrawing("Moving");
        this.camera.detachControl(this.canvas);
      } else {
        mode.innerText = "None";
        this.stopMoving();
      }
    });

    resizeButton.addEventListener("click", () => {
      this.resizeMode = !this.resizeMode;
      this.resizeMesh();
      if (this.resizeMode) {
        mode.innerText = "Resizing";
        this.stopDrawing("Resizing");
        this.camera.detachControl(this.canvas);
      } else {
        mode.innerText = "None";
        this.stopResizing();
      }
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      this.startDrawing(event);
    });

    this.canvas.addEventListener("pointerup", (event) => {
      if (this.moveMode) {
      }
    });

    undoButton.addEventListener("click", () => {
      this.undoAction();
    });

    redoButton.addEventListener("click", () => {
      this.redoAction();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "z" && event.ctrlKey) {
        this.undoAction();
      } else if (event.key === "y" && event.ctrlKey) {
        this.redoAction();
      }
    });

    this.createScene();
  }

  createScene() {
    let SCENE = new BABYLON.Scene(this.engine);
    var CAMERA = new BABYLON.ArcRotateCamera(
      "Camera",
      Math.PI / 2,
      Math.PI / 4,
      5,
      BABYLON.Vector3.Zero(),
      SCENE
    );
    CAMERA.attachControl(this.canvas, true);
    var light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(2, 1, 0),
      this.scene
    );

    // Create ground
    let GROUND = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: 6, height: 6 },
      this.scene
    );

    this.engine.runRenderLoop(function () {
      SCENE.render();
    });

    window.addEventListener("resize", () => {
      this.engine.resize();
    });

    let mat = new BABYLON.StandardMaterial("mat1", SCENE);
    mat.alpha = 1.0;
    mat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 1.0);
    mat.backFaceCulling = false;
    this.defaultMat = mat;

    let selectedMaterial = new BABYLON.StandardMaterial("selectedMat", SCENE);
    selectedMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    selectedMaterial.alpha = 0.8;
    selectedMaterial.useFresnel = true;
    selectedMaterial.fresnelColor = new BABYLON.Color3(1, 1, 1);
    selectedMaterial.bias = 0.1;
    selectedMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    this.selectedMat = selectedMaterial;

    this.scene = SCENE;
    this.camera = CAMERA;
    this.ground = GROUND;
  }

  startDrawing(event) {
    if (!this.drawMode) return;
    let scene = this.scene;
    let pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit) {
      let groundPoint = pickResult.pickedPoint;
      groundPoint.y = 0.01; // To avoid z-fighting
      if (event.buttons === 1) {
        //Left click
        this.currentShape.push(groundPoint);
        this.currentPolygon = this.drawLine();
      } else if (event.buttons === 2) {
        // Right click
        if (this.currentShape.length > 2) {
          this.currentShape.push(this.currentShape[0]); // Close the loop
          this.currentPolygon = this.drawLine();
          this.allPolygons.push(this.currentPolygon);
        } else {
          this.currentShape = [];
          this.currentPolygon.dispose();
        }
      }
    }
  }

  drawLine() {
    let line = BABYLON.MeshBuilder.CreateLines(
      "sh",
      { points: this.currentShape },
      this.scene
    );
    line.color = BABYLON.Color3.Green();
    this.lines.push(line);
    return line;
  }

  stopDrawing(modeType = "None") {
    mode.innerText = modeType;
    document.getElementById("extrudeButton").style.display = "none";
    this.drawMode = false;
    this.allPolygons.push(this.currentPolygon);
    this.currentShape = [];
  }

  stopMoving() {
    this.moveMode = false;
    this.resizeMode = false;
    this.camera.attachControl(this.canvas, true);
    if (this.selectedMesh) {
      this.selectedMesh.material = this.previousMeshMaterial;
      this.selectedMesh = null;
      this.previousMeshMaterial = null;
    }
  }

  stopResizing() {
    this.resizeMode = false;
    this.camera.attachControl(this.canvas, true);
    if (this.selectedMesh) {
      this.selectedMesh.material = this.previousMeshMaterial;
      this.selectedMesh = null;
      this.previousMeshMaterial = null;
    }
    if (this.pickableMeshes.length > 0) {
      this.pickableMeshes.forEach((mesh) => mesh.dispose());
      this.pickableMeshes = [];
    }
  }

  extrudeShape() {
    let polygonPoints = this.currentShape;

    //build 2D polygon points to use earcut
    let flattenedPoints = [];
    polygonPoints.forEach((point) => {
      flattenedPoints.push(point.x, point.z);
    });
    let triangles = earcut(flattenedPoints);

    let positions = [];
    let indices = [];

    // Adds the top and bottom vertices to the positions array
    polygonPoints.forEach((point) => {
      positions.push(point.x, 1, point.z); // top vertex
      positions.push(point.x, 0, point.z); // bottom vertex
    });

    // Adds the top and bottom triangles to the indices array
    for (let i = 0; i < triangles.length; i += 3) {
      let a = triangles[i];
      let b = triangles[i + 1];
      let c = triangles[i + 2];

      // Top triangle that has even number indices
      indices.push(a * 2, b * 2, c * 2);

      // Bottom triangle that has odd number indices
      indices.push(a * 2 + 1, c * 2 + 1, b * 2 + 1);
    }

    // Adds side faces to the indices array
    for (let i = 0; i < polygonPoints.length; i++) {
      let j = (i + 1) % polygonPoints.length;

      // Since walls are simple quads, two triangles can add up to a quad that represents a face
      indices.push(i * 2, j * 2, i * 2 + 1); // First triangle
      indices.push(j * 2, j * 2 + 1, i * 2 + 1); // Second triangle
    }

    let vertexData = new BABYLON.VertexData();

    vertexData.positions = positions;
    vertexData.indices = indices;

    let mesh = new BABYLON.Mesh("polygon", this.scene);
    mesh.material = this.defaultMat;
    vertexData.applyToMesh(mesh, true);

    this.lines.forEach((line) => line.dispose());
    this.stopDrawing();
  }

  selectMesh() {
    let { scene } = this;
    let pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit) {
      let pickedMesh = pickResult.pickedMesh;
      if ((this.moveMode || this.resizeMode) && pickedMesh.id !== "ground") {
        if (this.selectedMesh) {
          this.selectedMesh.material = this.previousMeshMaterial;
        }
        this.selectedMesh = pickedMesh;
        this.previousMeshMaterial = this.selectedMesh.material;
        this.selectedMesh.material = this.selectedMat;

        if (this.resizeMode) {
          this.handleResizeMesh();
        }
      }
    }
  }

  handleMoveMode() {
    //This function handles the movement of the object on the ground
    let { scene } = this;
    let continueMove = false;
    if (!this.moveMode) {
      scene.onPointerDown = () => {};
      scene.onPointerObservable.clear();
      return;
    }

    let pointerMoveFunction = (pointerInfo) => {
      switch (pointerInfo.type) {
        case BABYLON.PointerEventTypes.POINTERMOVE:
          if (this.selectedMesh && continueMove) {
            let pickResult = scene.pick(scene.pointerX, scene.pointerY);
            if (pickResult.hit && pickResult.pickedMesh.id === "ground") {
              var groundPoint = pickResult.pickedPoint;
              groundPoint.y = 0.01; //Need to keep the object on the ground
              this.selectedMesh.position = groundPoint;
            }
          }
          break;
      }
    };

    scene.onPointerDown = (evt, pickInfo) => {
      this.selectMesh(pickInfo);
      continueMove = true;
      if (this.selectedMesh) {
        let groundPoint = scene.pick(
          scene.pointerX,
          scene.pointerY
        ).pickedPoint;
        groundPoint.y = 0.01;
        this.selectedMesh.position = groundPoint;
      }
    };
    scene.onPointerObservable.add(pointerMoveFunction);
    scene.onPointerUp = (evt, pickInfo) => {
      let pickResult = scene.pick(scene.pointerX, scene.pointerY);
      if (pickResult.hit) {
        if (continueMove && this.selectedMesh) {
          continueMove = false;
        }
      }
    };
  }

  updateMeshVertices() {
    //Upon moving the object on the ground, the vertices of the object needs to be updated. This function returns the updated vertices
    let localPositions = this.selectedMesh.getVerticesData(
      BABYLON.VertexBuffer.PositionKind
    );

    let worldPositions = [];
    let worldMatrix = this.selectedMesh.getWorldMatrix();

    for (let i = 0; i < localPositions.length; i += 3) {
      let localPosition = new BABYLON.Vector3(
        localPositions[i],
        localPositions[i + 1],
        localPositions[i + 2]
      );

      let worldPosition = BABYLON.Vector3.TransformCoordinates(
        localPosition,
        worldMatrix
      );
      worldPositions.push(worldPosition.x, worldPosition.y, worldPosition.z);
    }
    return worldPositions;
  }

  resizeMesh() {
    let { scene } = this;
    scene.onPointerDown = (evt, pickInfo) => {
      this.selectMesh(pickInfo);
    };
  }

  handleResizeMesh() {
    let positions = this.updateMeshVertices();

    let sphereMat = new BABYLON.StandardMaterial("sphereMat", this.scene);
    sphereMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    let j = 0;

    for (let i = 0; i < positions.length - 3; i += 3) {
      const sphere = BABYLON.MeshBuilder.CreateSphere(
        `sphere-${j}`,
        { diameter: 0.1 },
        this.scene
      );
      j++;
      sphere.material = sphereMat;

      sphere.position = new BABYLON.Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      );
      this.pickableMeshes.push(sphere);
    }

    this.scene.onPointerDown = (evt, pickInfo) => {
      let pickResult = this.scene.pick(
        this.scene.pointerX,
        this.scene.pointerY
      );

      if (pickResult.hit) {
        let pickedMesh = pickResult.pickedMesh;
        if (pickedMesh.id.includes("sphere")) {
          let movingPoint = pickedMesh;
          console.log("SPHERE PICKED", pickedMesh.id);
          let spehereId = pickedMesh.id.split("-")[1];
          let index = parseInt(spehereId);
          this.scene.onPointerObservable.add((pointerInfo) => {
            switch (pointerInfo.type) {
              case BABYLON.PointerEventTypes.POINTERMOVE:
                if (this.selectedMesh) {
                  let pickResult = this.scene.pick(
                    this.scene.pointerX,
                    this.scene.pointerY
                  );
                  if (pickResult.hit && pickResult.pickedMesh.id === "ground") {
                    let groundPoint = pickResult.pickedPoint;
                    groundPoint.y = index % 2 === 0 ? 1 : 0.1; //Ensures the polygon object is above the ground. Keeps the top vertices and bottom vertices at the same level
                    movingPoint.position = groundPoint;
                    let positions = this.selectedMesh.getVerticesData(
                      BABYLON.VertexBuffer.PositionKind
                    );
                    positions[index * 3] = groundPoint.x;
                    positions[index * 3 + 1] = groundPoint.y;
                    positions[index * 3 + 2] = groundPoint.z;
                    this.selectedMesh.setVerticesData(
                      BABYLON.VertexBuffer.PositionKind,
                      positions
                    );
                  }
                }
                break;
            }
          });
        }
      }
    };

    this.scene.onPointerUp = () => {
      this.scene.onPointerObservable.clear();
      this.plane?.dispose();
    };
  }

  undoAction() {
    if (this.currentShape.length === 0) return;
    let lastPoint = this.currentShape[this.currentShape.length - 1];
    this.currentShape.pop();
    this.lines[this.lines.length - 1].dispose();
    this.lines.pop();
    this.redoStack.push(lastPoint);
  }

  redoAction() {
    if (this.redoStack.length === 0) return;
    console.log("REDO STACK", this.redoStack);
    let lastPoint = this.redoStack.pop();
    this.currentShape.push(lastPoint);
    this.drawLine();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new PlayGround();
});

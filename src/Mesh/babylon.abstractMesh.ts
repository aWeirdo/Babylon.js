﻿module BABYLON {
    export class AbstractMesh extends Node implements IDisposable, ICullable {
        // Statics
        private static _BILLBOARDMODE_NONE = 0;
        private static _BILLBOARDMODE_X = 1;
        private static _BILLBOARDMODE_Y = 2;
        private static _BILLBOARDMODE_Z = 4;
        private static _BILLBOARDMODE_ALL = 7;

        public static get BILLBOARDMODE_NONE(): number {
            return AbstractMesh._BILLBOARDMODE_NONE;
        }

        public static get BILLBOARDMODE_X(): number {
            return AbstractMesh._BILLBOARDMODE_X;
        }

        public static get BILLBOARDMODE_Y(): number {
            return AbstractMesh._BILLBOARDMODE_Y;
        }

        public static get BILLBOARDMODE_Z(): number {
            return AbstractMesh._BILLBOARDMODE_Z;
        }

        public static get BILLBOARDMODE_ALL(): number {
            return AbstractMesh._BILLBOARDMODE_ALL;
        }

        // facetData private properties
        private _facetPositions: Vector3[];             // facet local positions
        private _facetNormals: Vector3[];               // facet local normals
        private _facetPartitioning: number[][];           // partitioning array of facet index arrays
        private _facetNb: number = 0;                   // facet number
        private _partitioningSubdivisions: number = 10; // number of subdivisions per axis in the partioning space  
        private _partitioningBBoxRatio: number = 1.01;  // the partioning array space is by default 1% bigger than the bounding box
        private _facetDataEnabled: boolean = false;     // is the facet data feature enabled on this mesh ?
        private _facetParameters: any = {};                  // keep a reference to the object parameters to avoid memory re-allocation
        private _bbSize: Vector3 = Vector3.Zero();      // bbox size approximated for facet data
        private _subDiv = {                         // actual number of subdivisions per axis for ComputeNormals()
            max: 1,
            X: 1,
            Y: 1,
            Z: 1
        };
        /**
         * Read-only : the number of facets in the mesh
         */
        public get facetNb(): number {
            return this._facetNb;
        }
        /**
         * The number of subdivisions per axis in the partioning space
         */
        public get partitioningSubdivisions(): number {
            return this._partitioningSubdivisions;
        }
        public set partitioningSubdivisions(nb: number) {
            this._partitioningSubdivisions = nb;
        } 
        /**
         * The ratio to apply to the bouding box size to set to the partioning space.  
         * Ex : 1.01 (default) the partioning space is 1% bigger than the bounding box.
         */
        public get partitioningBBoxRatio(): number {
            return this._partitioningBBoxRatio;
        }
        public set partitioningBBoxRatio(ratio: number) {
            this._partitioningBBoxRatio = ratio;
        }
        /**
         * Read-only : is the feature facetData enabled ?
         */
        public get isFacetDataEnabled(): boolean {
            return this._facetDataEnabled;
        }


        // Events

        /**
        * An event triggered when this mesh collides with another one
        * @type {BABYLON.Observable}
        */
        public onCollideObservable = new Observable<AbstractMesh>();

        private _onCollideObserver: Observer<AbstractMesh>;
        public set onCollide(callback: () => void) {
            if (this._onCollideObserver) {
                this.onCollideObservable.remove(this._onCollideObserver);
            }
            this._onCollideObserver = this.onCollideObservable.add(callback);
        }

        /**
        * An event triggered when the collision's position changes
        * @type {BABYLON.Observable}
        */
        public onCollisionPositionChangeObservable = new Observable<Vector3>();

        private _onCollisionPositionChangeObserver: Observer<Vector3>;
        public set onCollisionPositionChange(callback: () => void) {
            if (this._onCollisionPositionChangeObserver) {
                this.onCollisionPositionChangeObservable.remove(this._onCollisionPositionChangeObserver);
            }
            this._onCollisionPositionChangeObserver = this.onCollisionPositionChangeObservable.add(callback);
        }

        /**
        * An event triggered after the world matrix is updated
        * @type {BABYLON.Observable}
        */
        public onAfterWorldMatrixUpdateObservable = new Observable<AbstractMesh>();

        // Properties
        public definedFacingForward = true; // orientation for POV movement & rotation
        public position = new Vector3(0.0, 0.0, 0.0);
        private _rotation = new Vector3(0.0, 0.0, 0.0);
        public _rotationQuaternion: Quaternion;
        private _scaling = new Vector3(1.0, 1.0, 1.0);
        public billboardMode = AbstractMesh.BILLBOARDMODE_NONE;
        public visibility = 1.0;
        public alphaIndex = Number.MAX_VALUE;
        public infiniteDistance = false;
        public isVisible = true;
        public isPickable = true;
        public showBoundingBox = false;
        public showSubMeshesBoundingBox = false;
        public isBlocker = false;
        public renderingGroupId = 0;
        public material: Material;
        public receiveShadows = false;
        public renderOutline = false;
        public outlineColor = Color3.Red();
        public outlineWidth = 0.02;
        public renderOverlay = false;
        public overlayColor = Color3.Red();
        public overlayAlpha = 0.5;
        public hasVertexAlpha = false;
        public useVertexColors = true;
        public applyFog = true;
        public computeBonesUsingShaders = true;
        public scalingDeterminant = 1;
        public numBoneInfluencers = 4;

        public useOctreeForRenderingSelection = true;
        public useOctreeForPicking = true;
        public useOctreeForCollisions = true;

        public layerMask: number = 0x0FFFFFFF;
        /**
         * True if the mesh must be rendered in any case.  
         */
        public alwaysSelectAsActiveMesh = false;

        /**
         * This scene's action manager
         * @type {BABYLON.ActionManager}
        */
        public actionManager: ActionManager;

        // Physics
        public physicsImpostor: BABYLON.PhysicsImpostor;
        //Deprecated, Legacy support
        public onPhysicsCollide: (collidedMesh: AbstractMesh, contact: any) => void;

        // Collisions
        private _checkCollisions = false;
        private _collisionGroup = -1;
        private _collisionMask = -1;
        public ellipsoid = new Vector3(0.5, 1, 0.5);
        public ellipsoidOffset = new Vector3(0, 0, 0);
        private _collider = new Collider();
        private _oldPositionForCollisions = new Vector3(0, 0, 0);
        private _diffPositionForCollisions = new Vector3(0, 0, 0);
        private _newPositionForCollisions = new Vector3(0, 0, 0);
        
        public set setCollisionGroup(mask: number) {
            this._collisionGroup = !isNaN(mask) ? mask : -1;
        }
        
        public set setCollisionMask(mask: number) {
            this._collisionMask = !isNaN(mask) ? mask : -1;
        }

        // Attach to bone
        private _meshToBoneReferal: AbstractMesh;

        // Edges
        public edgesWidth = 1;
        public edgesColor = new Color4(1, 0, 0, 1);
        public _edgesRenderer: EdgesRenderer;

        // Cache
        private _localWorld = Matrix.Zero();
        public _worldMatrix = Matrix.Zero();
        private _rotateYByPI = Matrix.RotationY(Math.PI);
        private _absolutePosition = Vector3.Zero();
        private _collisionsTransformMatrix = Matrix.Zero();
        private _collisionsScalingMatrix = Matrix.Zero();
        public _positions: Vector3[];
        private _isDirty = false;
        public _masterMesh: AbstractMesh;
        public _materialDefines: MaterialDefines;

        public _boundingInfo: BoundingInfo;
        private _pivotMatrix = Matrix.Identity();
        public _isDisposed = false;
        public _renderId = 0;

        public subMeshes: SubMesh[];
        public _submeshesOctree: Octree<SubMesh>;
        public _intersectionsInProgress = new Array<AbstractMesh>();

        private _isWorldMatrixFrozen = false;

        public _unIndexed = false;

        public _poseMatrix: Matrix;

        // Loading properties
        public _waitingActions: any;
        public _waitingFreezeWorldMatrix: boolean;

        // Skeleton
        private _skeleton: Skeleton;
        public _bonesTransformMatrices: Float32Array;

        public set skeleton(value: Skeleton) {
            if (this._skeleton && this._skeleton.needInitialSkinMatrix) {
                this._skeleton._unregisterMeshWithPoseMatrix(this);
            }

            if (value && value.needInitialSkinMatrix) {
                value._registerMeshWithPoseMatrix(this);
            }

            this._skeleton = value;

            if (!this._skeleton) {
                this._bonesTransformMatrices = null;
            }
        }

        public get skeleton(): Skeleton {
            return this._skeleton;
        }

        // Constructor
        constructor(name: string, scene: Scene) {
            super(name, scene);

            scene.addMesh(this);
        }

        /**
         * Returns the string "AbstractMesh"
         */
        public getClassName(): string {
            return "AbstractMesh";
        }

        /**
         * @param {boolean} fullDetails - support for multiple levels of logging within scene loading
         */
        public toString(fullDetails?: boolean): string {
            var ret = "Name: " + this.name + ", isInstance: " + (this instanceof InstancedMesh ? "YES" : "NO");
            ret += ", # of submeshes: " + (this.subMeshes ? this.subMeshes.length : 0);
            if (this._skeleton) {
                ret += ", skeleton: " + this._skeleton.name;
            }
            if (fullDetails) {
                ret += ", billboard mode: " + (["NONE", "X", "Y", null, "Z", null, null, "ALL"])[this.billboardMode];
                ret += ", freeze wrld mat: " + (this._isWorldMatrixFrozen || this._waitingFreezeWorldMatrix ? "YES" : "NO");
            }
            return ret;
        }

        /**
         * Rotation property : a Vector3 depicting the rotation value in radians around each local axis X, Y, Z. 
         * If rotation quaternion is set, this Vector3 will (almost always) be the Zero vector!
         * Default : (0.0, 0.0, 0.0)
         */
        public get rotation(): Vector3 {
            return this._rotation;
        }

        public set rotation(newRotation: Vector3) {
            this._rotation = newRotation;
        }

        /**
         * Scaling property : a Vector3 depicting the mesh scaling along each local axis X, Y, Z.  
         * Default : (1.0, 1.0, 1.0)
         */
        public get scaling(): Vector3 {
            return this._scaling;
        }

        public set scaling(newScaling: Vector3) {
            this._scaling = newScaling;
            if (this.physicsImpostor) {
                this.physicsImpostor.forceUpdate();
            }
        }

        /**
         * Rotation Quaternion property : this a Quaternion object depicting the mesh rotation by using a unit quaternion. 
         * It's null by default.  
         * If set, only the rotationQuaternion is then used to compute the mesh rotation and its property `.rotation\ is then ignored and set to (0.0, 0.0, 0.0)
         */
        public get rotationQuaternion() {
            return this._rotationQuaternion;
        }

        public set rotationQuaternion(quaternion: Quaternion) {
            this._rotationQuaternion = quaternion;
            //reset the rotation vector. 
            if (quaternion && this.rotation.length()) {
                this.rotation.copyFromFloats(0.0, 0.0, 0.0);
            }
        }

        // Methods
        /**
         * Copies the paramater passed Matrix into the mesh Pose matrix.  
         * Returns nothing.  
         */
        public updatePoseMatrix(matrix: Matrix) {
            this._poseMatrix.copyFrom(matrix);
        }

        /**
         * Returns the mesh Pose matrix.  
         * Returned object : Matrix
         */
        public getPoseMatrix(): Matrix {
            return this._poseMatrix;
        }

        /**
         * Disables the mesh edger rendering mode.  
         * Returns nothing.  
         */
        public disableEdgesRendering(): void {
            if (this._edgesRenderer !== undefined) {
                this._edgesRenderer.dispose();
                this._edgesRenderer = undefined;
            }
        }
        /**
         * Enables the edge rendering mode on the mesh.  
         * This mode makes the mesh edges visible.  
         * Returns nothing.  
         */
        public enableEdgesRendering(epsilon = 0.95, checkVerticesInsteadOfIndices = false) {
            this.disableEdgesRendering();

            this._edgesRenderer = new EdgesRenderer(this, epsilon, checkVerticesInsteadOfIndices);
        }

        /**
         * Returns true if the mesh is blocked. Used by the class Mesh.
         * Returns the boolean `false` by default.  
         */
        public get isBlocked(): boolean {
            return false;
        }

        /**
         * Returns the mesh itself by default, used by the class Mesh.  
         * Returned type : AbstractMesh
         */
        public getLOD(camera: Camera): AbstractMesh {
            return this;
        }

        /**
         * Returns 0 by default, used by the class Mesh.  
         * Returns an integer.  
         */
        public getTotalVertices(): number {
            return 0;
        }

        /**
         * Returns null by default, used by the class Mesh. 
         * Returned type : integer array 
         */
        public getIndices(): IndicesArray {
            return null;
        }

        /**
         * Returns the array of the requested vertex data kind. Used by the class Mesh. Returns null here. 
         * Returned type : float array or Float32Array 
         */
        public getVerticesData(kind: string): number[] | Float32Array {
            return null;
        }

        /** Returns false by default, used by the class Mesh.  
         *  Returns a boolean
        */
        public isVerticesDataPresent(kind: string): boolean {
            return false;
        }

        /**
         * Returns the mesh BoundingInfo object or creates a new one and returns it if undefined.
         * Returns a BoundingInfo
         */
        public getBoundingInfo(): BoundingInfo {
            if (this._masterMesh) {
                return this._masterMesh.getBoundingInfo();
            }

            if (!this._boundingInfo) {
                this._updateBoundingInfo();
            }
            return this._boundingInfo;
        }

        /**
         * Sets a mesh new object BoundingInfo.
         * Returns nothing.  
         */
        public setBoundingInfo(boundingInfo: BoundingInfo): void {
            this._boundingInfo = boundingInfo;
        }

        public get useBones(): boolean {
            return this.skeleton && this.getScene().skeletonsEnabled && this.isVerticesDataPresent(VertexBuffer.MatricesIndicesKind) && this.isVerticesDataPresent(VertexBuffer.MatricesWeightsKind);
        }

        public _preActivate(): void {
        }

        public _preActivateForIntermediateRendering(renderId: number): void {
        }

        public _activate(renderId: number): void {
            this._renderId = renderId;
        }

        /**
         * Returns the last update of the World matrix
         * Returns a Matrix.  
         */
        public getWorldMatrix(): Matrix {
            if (this._masterMesh) {
                return this._masterMesh.getWorldMatrix();
            }

            if (this._currentRenderId !== this.getScene().getRenderId()) {
                this.computeWorldMatrix();
            }
            return this._worldMatrix;
        }

        /**
         * Returns directly the last state of the mesh World matrix. 
         * A Matrix is returned.    
         */
        public get worldMatrixFromCache(): Matrix {
            return this._worldMatrix;
        }

        /**
         * Returns the current mesh absolute position.
         * Retuns a Vector3
         */
        public get absolutePosition(): Vector3 {
            return this._absolutePosition;
        }
        /**
         * Prevents the World matrix to be computed any longer.
         * Returns nothing.  
         */
        public freezeWorldMatrix() {
            this._isWorldMatrixFrozen = false;  // no guarantee world is not already frozen, switch off temporarily
            this.computeWorldMatrix(true);
            this._isWorldMatrixFrozen = true;
        }

        /**
         * Allows back the World matrix computation. 
         * Returns nothing.  
         */
        public unfreezeWorldMatrix() {
            this._isWorldMatrixFrozen = false;
            this.computeWorldMatrix(true);
        }

        /**
         * True if the World matrix has been frozen.  
         * Returns a boolean.  
         */
        public get isWorldMatrixFrozen(): boolean {
            return this._isWorldMatrixFrozen;
        }

        private static _rotationAxisCache = new Quaternion();
        /**
         * Rotates the mesh around the axis vector for the passed angle (amount) expressed in radians, in the given space.  
         * space (default LOCAL) can be either BABYLON.Space.LOCAL, either BABYLON.Space.WORLD
         */
        public rotate(axis: Vector3, amount: number, space?: Space): void {
            axis.normalize();

            if (!this.rotationQuaternion) {
                this.rotationQuaternion = Quaternion.RotationYawPitchRoll(this.rotation.y, this.rotation.x, this.rotation.z);
                this.rotation = Vector3.Zero();
            }
            var rotationQuaternion: Quaternion;
            if (!space || (space as any) === Space.LOCAL) {
                rotationQuaternion = Quaternion.RotationAxisToRef(axis, amount, AbstractMesh._rotationAxisCache);
                this.rotationQuaternion.multiplyToRef(rotationQuaternion, this.rotationQuaternion);
            }
            else {
                if (this.parent) {
                    var invertParentWorldMatrix = this.parent.getWorldMatrix().clone();
                    invertParentWorldMatrix.invert();

                    axis = Vector3.TransformNormal(axis, invertParentWorldMatrix);
                }
                rotationQuaternion = Quaternion.RotationAxisToRef(axis, amount, AbstractMesh._rotationAxisCache);
                rotationQuaternion.multiplyToRef(this.rotationQuaternion, this.rotationQuaternion);
            }
        }

        /**
         * Translates the mesh along the axis vector for the passed distance in the given space.  
         * space (default LOCAL) can be either BABYLON.Space.LOCAL, either BABYLON.Space.WORLD
         */
        public translate(axis: Vector3, distance: number, space?: Space): void {
            var displacementVector = axis.scale(distance);

            if (!space || (space as any) === Space.LOCAL) {
                var tempV3 = this.getPositionExpressedInLocalSpace().add(displacementVector);
                this.setPositionWithLocalVector(tempV3);
            }
            else {
                this.setAbsolutePosition(this.getAbsolutePosition().add(displacementVector));
            }
        }

        /**
         * Adds a rotation step to the mesh current rotation.  
         * x, y, z are Euler angles expressed in radians.  
         * This methods updates the current mesh rotation, either mesh.rotation, either mesh.rotationQuaternion if it's set.  
         * This means this rotation is made in the mesh local space only.   
         * It's useful to set a custom rotation order different from the BJS standard one YXZ.  
         * Example : this rotates the mesh first around its local X axis, then around its local Z axis, finally around its local Y axis.  
         * ```javascript
         * mesh.addRotation(x1, 0, 0).addRotation(0, 0, z2).addRotation(0, 0, y3);
         * ```
         * Note that `addRotation()` accumulates the passed rotation values to the current ones and computes the .rotation or .rotationQuaternion updated values.  
         * Under the hood, only quaternions are used. So it's a little faster is you use .rotationQuaternion because it doesn't need to translate them back to Euler angles.  
         */
        public addRotation(x: number, y: number, z: number): AbstractMesh {
            var rotationQuaternion;
            if (this.rotationQuaternion) {
                rotationQuaternion = this.rotationQuaternion;
            }
            else {
                rotationQuaternion = Tmp.Quaternion[1];
                Quaternion.RotationYawPitchRollToRef(this.rotation.y, this.rotation.x, this.rotation.z, rotationQuaternion);
            }
            var accumulation = BABYLON.Tmp.Quaternion[0];
            Quaternion.RotationYawPitchRollToRef(y, x, z, accumulation);
            rotationQuaternion.multiplyInPlace(accumulation);
            if (!this.rotationQuaternion) {
                rotationQuaternion.toEulerAnglesToRef(this.rotation);
            }
            return this;
        }

        /**
         * Retuns the mesh absolute position in the World.  
         * Returns a Vector3
         */
        public getAbsolutePosition(): Vector3 {
            this.computeWorldMatrix();
            return this._absolutePosition;
        }

        /**
         * Sets the mesh absolute position in the World from a Vector3 or an Array(3).
         * Returns nothing.  
         */
        public setAbsolutePosition(absolutePosition: Vector3): void {
            if (!absolutePosition) {
                return;
            }

            var absolutePositionX;
            var absolutePositionY;
            var absolutePositionZ;

            if (absolutePosition.x === undefined) {
                if (arguments.length < 3) {
                    return;
                }
                absolutePositionX = arguments[0];
                absolutePositionY = arguments[1];
                absolutePositionZ = arguments[2];
            }
            else {
                absolutePositionX = absolutePosition.x;
                absolutePositionY = absolutePosition.y;
                absolutePositionZ = absolutePosition.z;
            }

            if (this.parent) {
                var invertParentWorldMatrix = this.parent.getWorldMatrix().clone();
                invertParentWorldMatrix.invert();

                var worldPosition = new Vector3(absolutePositionX, absolutePositionY, absolutePositionZ);

                this.position = Vector3.TransformCoordinates(worldPosition, invertParentWorldMatrix);
            } else {
                this.position.x = absolutePositionX;
                this.position.y = absolutePositionY;
                this.position.z = absolutePositionZ;
            }
        }
        // ================================== Point of View Movement =================================
        /**
         * Perform relative position change from the point of view of behind the front of the mesh.
         * This is performed taking into account the meshes current rotation, so you do not have to care.
         * Supports definition of mesh facing forward or backward.
         * @param {number} amountRight
         * @param {number} amountUp
         * @param {number} amountForward
         */
        public movePOV(amountRight: number, amountUp: number, amountForward: number): void {
            this.position.addInPlace(this.calcMovePOV(amountRight, amountUp, amountForward));
        }

        /**
         * Calculate relative position change from the point of view of behind the front of the mesh.
         * This is performed taking into account the meshes current rotation, so you do not have to care.
         * Supports definition of mesh facing forward or backward.
         * @param {number} amountRight
         * @param {number} amountUp
         * @param {number} amountForward
         */
        public calcMovePOV(amountRight: number, amountUp: number, amountForward: number): Vector3 {
            var rotMatrix = new Matrix();
            var rotQuaternion = (this.rotationQuaternion) ? this.rotationQuaternion : Quaternion.RotationYawPitchRoll(this.rotation.y, this.rotation.x, this.rotation.z);
            rotQuaternion.toRotationMatrix(rotMatrix);

            var translationDelta = Vector3.Zero();
            var defForwardMult = this.definedFacingForward ? -1 : 1;
            Vector3.TransformCoordinatesFromFloatsToRef(amountRight * defForwardMult, amountUp, amountForward * defForwardMult, rotMatrix, translationDelta);
            return translationDelta;
        }
        // ================================== Point of View Rotation =================================
        /**
         * Perform relative rotation change from the point of view of behind the front of the mesh.
         * Supports definition of mesh facing forward or backward.
         * @param {number} flipBack
         * @param {number} twirlClockwise
         * @param {number} tiltRight
         */
        public rotatePOV(flipBack: number, twirlClockwise: number, tiltRight: number): void {
            this.rotation.addInPlace(this.calcRotatePOV(flipBack, twirlClockwise, tiltRight));
        }

        /**
         * Calculate relative rotation change from the point of view of behind the front of the mesh.
         * Supports definition of mesh facing forward or backward.
         * @param {number} flipBack
         * @param {number} twirlClockwise
         * @param {number} tiltRight
         */
        public calcRotatePOV(flipBack: number, twirlClockwise: number, tiltRight: number): Vector3 {
            var defForwardMult = this.definedFacingForward ? 1 : -1;
            return new Vector3(flipBack * defForwardMult, twirlClockwise, tiltRight * defForwardMult);
        }

        /**
         * Sets a new pivot matrix to the mesh.  
         * Returns nothing.
         */
        public setPivotMatrix(matrix: Matrix): void {
            this._pivotMatrix = matrix;
            this._cache.pivotMatrixUpdated = true;
        }

        /**
         * Returns the mesh pivot matrix.
         * Default : Identity.  
         * A Matrix is returned.  
         */
        public getPivotMatrix(): Matrix {
            return this._pivotMatrix;
        }

        public _isSynchronized(): boolean {
            if (this._isDirty) {
                return false;
            }

            if (this.billboardMode !== this._cache.billboardMode || this.billboardMode !== AbstractMesh.BILLBOARDMODE_NONE)
                return false;

            if (this._cache.pivotMatrixUpdated) {
                return false;
            }

            if (this.infiniteDistance) {
                return false;
            }

            if (!this._cache.position.equals(this.position))
                return false;

            if (this.rotationQuaternion) {
                if (!this._cache.rotationQuaternion.equals(this.rotationQuaternion))
                    return false;
            }

            if (!this._cache.rotation.equals(this.rotation))
                return false;

            if (!this._cache.scaling.equals(this.scaling))
                return false;

            return true;
        }

        public _initCache() {
            super._initCache();

            this._cache.localMatrixUpdated = false;
            this._cache.position = Vector3.Zero();
            this._cache.scaling = Vector3.Zero();
            this._cache.rotation = Vector3.Zero();
            this._cache.rotationQuaternion = new Quaternion(0, 0, 0, 0);
            this._cache.billboardMode = -1;
        }

        public markAsDirty(property: string): void {
            if (property === "rotation") {
                this.rotationQuaternion = null;
            }
            this._currentRenderId = Number.MAX_VALUE;
            this._isDirty = true;
        }

        /**
         * Updates the mesh BoundingInfo object and all its children BoundingInfo objects also.  
         * Returns nothing.  
         */
        public _updateBoundingInfo(): void {
            this._boundingInfo = this._boundingInfo || new BoundingInfo(this.absolutePosition, this.absolutePosition);

            this._boundingInfo.update(this.worldMatrixFromCache);

            this._updateSubMeshesBoundingInfo(this.worldMatrixFromCache);
        }

        /**
         * Update a mesh's children BoundingInfo objects only.  
         * Returns nothing.  
         */
        public _updateSubMeshesBoundingInfo(matrix: Matrix): void {
            if (!this.subMeshes) {
                return;
            }

            for (var subIndex = 0; subIndex < this.subMeshes.length; subIndex++) {
                var subMesh = this.subMeshes[subIndex];

                if (!subMesh.IsGlobal) {
                    subMesh.updateBoundingInfo(matrix);
                }
            }
        }

        /**
         * Computes the mesh World matrix and returns it.  
         * If the mesh world matrix is frozen, this computation does nothing more than returning the last frozen values.  
         * If the parameter `force` is let to `false` (default), the current cached World matrix is returned. 
         * If the parameter `force`is set to `true`, the actual computation is done.  
         * Returns the mesh World Matrix.
         */
        public computeWorldMatrix(force?: boolean): Matrix {
            if (this._isWorldMatrixFrozen) {
                return this._worldMatrix;
            }

            if (!force && (this._currentRenderId === this.getScene().getRenderId() || this.isSynchronized(true))) {
                this._currentRenderId = this.getScene().getRenderId();
                return this._worldMatrix;
            }

            this._cache.position.copyFrom(this.position);
            this._cache.scaling.copyFrom(this.scaling);
            this._cache.pivotMatrixUpdated = false;
            this._cache.billboardMode = this.billboardMode;
            this._currentRenderId = this.getScene().getRenderId();
            this._isDirty = false;

            // Scaling
            Matrix.ScalingToRef(this.scaling.x * this.scalingDeterminant, this.scaling.y * this.scalingDeterminant, this.scaling.z * this.scalingDeterminant, Tmp.Matrix[1]);

            // Rotation

            //rotate, if quaternion is set and rotation was used
            if (this.rotationQuaternion) {
                var len = this.rotation.length();
                if (len) {
                    this.rotationQuaternion.multiplyInPlace(BABYLON.Quaternion.RotationYawPitchRoll(this.rotation.y, this.rotation.x, this.rotation.z))
                    this.rotation.copyFromFloats(0, 0, 0);
                }
            }

            if (this.rotationQuaternion) {
                this.rotationQuaternion.toRotationMatrix(Tmp.Matrix[0]);
                this._cache.rotationQuaternion.copyFrom(this.rotationQuaternion);
            } else {
                Matrix.RotationYawPitchRollToRef(this.rotation.y, this.rotation.x, this.rotation.z, Tmp.Matrix[0]);
                this._cache.rotation.copyFrom(this.rotation);
            }

            // Translation
            if (this.infiniteDistance && !this.parent) {
                var camera = this.getScene().activeCamera;
                if (camera) {
                    var cameraWorldMatrix = camera.getWorldMatrix();

                    var cameraGlobalPosition = new Vector3(cameraWorldMatrix.m[12], cameraWorldMatrix.m[13], cameraWorldMatrix.m[14]);

                    Matrix.TranslationToRef(this.position.x + cameraGlobalPosition.x, this.position.y + cameraGlobalPosition.y,
                        this.position.z + cameraGlobalPosition.z, Tmp.Matrix[2]);
                }
            } else {
                Matrix.TranslationToRef(this.position.x, this.position.y, this.position.z, Tmp.Matrix[2]);
            }

            // Composing transformations
            this._pivotMatrix.multiplyToRef(Tmp.Matrix[1], Tmp.Matrix[4]);
            Tmp.Matrix[4].multiplyToRef(Tmp.Matrix[0], Tmp.Matrix[5]);

            // Billboarding
            if (this.billboardMode !== AbstractMesh.BILLBOARDMODE_NONE && this.getScene().activeCamera) {
                Tmp.Vector3[0].copyFrom(this.position);
                var localPosition = Tmp.Vector3[0];

                if (this.parent && this.parent.getWorldMatrix) {
                    this._markSyncedWithParent();

                    var parentMatrix: Matrix;
                    if (this._meshToBoneReferal) {
                        this.parent.getWorldMatrix().multiplyToRef(this._meshToBoneReferal.getWorldMatrix(), Tmp.Matrix[6]);
                        parentMatrix = Tmp.Matrix[6];
                    } else {
                        parentMatrix = this.parent.getWorldMatrix();
                    }

                    Vector3.TransformNormalToRef(localPosition, parentMatrix, Tmp.Vector3[1]);
                    localPosition = Tmp.Vector3[1];
                }

                var zero = this.getScene().activeCamera.globalPosition.clone();

                if (this.parent && (<any>this.parent).position) {
                    localPosition.addInPlace((<any>this.parent).position);
                    Matrix.TranslationToRef(localPosition.x, localPosition.y, localPosition.z, Tmp.Matrix[2]);
                }

                if ((this.billboardMode & AbstractMesh.BILLBOARDMODE_ALL) !== AbstractMesh.BILLBOARDMODE_ALL) {
                    if (this.billboardMode & AbstractMesh.BILLBOARDMODE_X)
                        zero.x = localPosition.x + Epsilon;
                    if (this.billboardMode & AbstractMesh.BILLBOARDMODE_Y)
                        zero.y = localPosition.y + Epsilon;
                    if (this.billboardMode & AbstractMesh.BILLBOARDMODE_Z)
                        zero.z = localPosition.z + Epsilon;
                }

                Matrix.LookAtLHToRef(localPosition, zero, Vector3.Up(), Tmp.Matrix[3]);
                Tmp.Matrix[3].m[12] = Tmp.Matrix[3].m[13] = Tmp.Matrix[3].m[14] = 0;

                Tmp.Matrix[3].invert();

                Tmp.Matrix[5].multiplyToRef(Tmp.Matrix[3], this._localWorld);
                this._rotateYByPI.multiplyToRef(this._localWorld, Tmp.Matrix[5]);
            }

            // Local world
            Tmp.Matrix[5].multiplyToRef(Tmp.Matrix[2], this._localWorld);

            // Parent
            if (this.parent && this.parent.getWorldMatrix && this.billboardMode === AbstractMesh.BILLBOARDMODE_NONE) {
                this._markSyncedWithParent();

                if (this._meshToBoneReferal) {
                    this._localWorld.multiplyToRef(this.parent.getWorldMatrix(), Tmp.Matrix[6]);
                    Tmp.Matrix[6].multiplyToRef(this._meshToBoneReferal.getWorldMatrix(), this._worldMatrix);
                } else {
                    this._localWorld.multiplyToRef(this.parent.getWorldMatrix(), this._worldMatrix);
                }
            } else {
                this._worldMatrix.copyFrom(this._localWorld);
            }

            // Bounding info
            this._updateBoundingInfo();

            // Absolute position
            this._absolutePosition.copyFromFloats(this._worldMatrix.m[12], this._worldMatrix.m[13], this._worldMatrix.m[14]);

            // Callbacks
            this.onAfterWorldMatrixUpdateObservable.notifyObservers(this);

            if (!this._poseMatrix) {
                this._poseMatrix = Matrix.Invert(this._worldMatrix);
            }

            return this._worldMatrix;
        }

        /**
        * If you'd like to be called back after the mesh position, rotation or scaling has been updated
        * @param func: callback function to add
        */
        public registerAfterWorldMatrixUpdate(func: (mesh: AbstractMesh) => void): void {
            this.onAfterWorldMatrixUpdateObservable.add(func);
        }

        /**
         * Removes a registered callback function
         */
        public unregisterAfterWorldMatrixUpdate(func: (mesh: AbstractMesh) => void): void {
            this.onAfterWorldMatrixUpdateObservable.removeCallback(func);
        }

        public setPositionWithLocalVector(vector3: Vector3): void {
            this.computeWorldMatrix();

            this.position = Vector3.TransformNormal(vector3, this._localWorld);
        }

        /**
         * Returns the mesh position in the local space from the current World matrix values.
         * Returns a new Vector3.
         */
        public getPositionExpressedInLocalSpace(): Vector3 {
            this.computeWorldMatrix();
            var invLocalWorldMatrix = this._localWorld.clone();
            invLocalWorldMatrix.invert();

            return Vector3.TransformNormal(this.position, invLocalWorldMatrix);
        }

        public locallyTranslate(vector3: Vector3): void {
            this.computeWorldMatrix(true);

            this.position = Vector3.TransformCoordinates(vector3, this._localWorld);
        }

        private static _lookAtVectorCache = new Vector3(0, 0, 0);
        public lookAt(targetPoint: Vector3, yawCor: number = 0, pitchCor: number = 0, rollCor: number = 0, space: Space = Space.LOCAL): void {
            /// <summary>Orients a mesh towards a target point. Mesh must be drawn facing user.</summary>
            /// <param name="targetPoint" type="Vector3">The position (must be in same space as current mesh) to look at</param>
            /// <param name="yawCor" type="Number">optional yaw (y-axis) correction in radians</param>
            /// <param name="pitchCor" type="Number">optional pitch (x-axis) correction in radians</param>
            /// <param name="rollCor" type="Number">optional roll (z-axis) correction in radians</param>
            /// <returns>Mesh oriented towards targetMesh</returns>

            var dv = AbstractMesh._lookAtVectorCache;
            var pos = space === Space.LOCAL ? this.position : this.getAbsolutePosition();
            targetPoint.subtractToRef(pos, dv);
            var yaw = -Math.atan2(dv.z, dv.x) - Math.PI / 2;
            var len = Math.sqrt(dv.x * dv.x + dv.z * dv.z);
            var pitch = Math.atan2(dv.y, len);
            this.rotationQuaternion = this.rotationQuaternion || new Quaternion();
            Quaternion.RotationYawPitchRollToRef(yaw + yawCor, pitch + pitchCor, rollCor, this.rotationQuaternion);
        }

        public attachToBone(bone: Bone, affectedMesh: AbstractMesh): void {
            this._meshToBoneReferal = affectedMesh;
            this.parent = bone;

            if (bone.getWorldMatrix().determinant() < 0) {
                this.scalingDeterminant *= -1;
            }
        }

        public detachFromBone(): void {
            if (this.parent.getWorldMatrix().determinant() < 0) {
                this.scalingDeterminant *= -1;
            }

            this._meshToBoneReferal = null;
            this.parent = null;
        }

        /**
         * Returns `true` if the mesh is within the frustum defined by the passed array of planes.  
         * A mesh is in the frustum if its bounding box intersects the frustum.  
         * Boolean returned.  
         */
        public isInFrustum(frustumPlanes: Plane[]): boolean {
            return this._boundingInfo.isInFrustum(frustumPlanes);
        }

        /**
         * Returns `true` if the mesh is completely in the frustum defined be the passed array of planes.  
         * A mesh is completely in the frustum if its bounding box it completely inside the frustum.  
         * Boolean returned.  
         */
        public isCompletelyInFrustum(frustumPlanes: Plane[]): boolean {
            return this._boundingInfo.isCompletelyInFrustum(frustumPlanes);;
        }

        /** 
         * True if the mesh intersects another mesh or a SolidParticle object.  
         * Unless the parameter `precise` is set to `true` the intersection is computed according to Axis Aligned Bounding Boxes (AABB), else according to OBB (Oriented BBoxes)
         * Returns a boolean.  
         */
        public intersectsMesh(mesh: AbstractMesh | SolidParticle, precise?: boolean): boolean {
            if (!this._boundingInfo || !mesh._boundingInfo) {
                return false;
            }

            return this._boundingInfo.intersects(mesh._boundingInfo, precise);
        }

        /**
         * Returns true if the passed point (Vector3) is inside the mesh bounding box.  
         * Returns a boolean.  
         */
        public intersectsPoint(point: Vector3): boolean {
            if (!this._boundingInfo) {
                return false;
            }

            return this._boundingInfo.intersectsPoint(point);
        }

        // Physics
        /**
         *  @Deprecated. Use new PhysicsImpostor instead.
         * */
        public setPhysicsState(impostor?: any, options?: PhysicsImpostorParameters): any {
            //legacy support
            if (impostor.impostor) {
                options = impostor;
                impostor = impostor.impostor;
            }
            this.physicsImpostor = new PhysicsImpostor(this, impostor, options, this.getScene());
            return this.physicsImpostor.physicsBody;
        }

        public getPhysicsImpostor(): PhysicsImpostor {
            return this.physicsImpostor;
        }

        /**
         * @Deprecated. Use getPhysicsImpostor().getParam("mass");
         */
        public getPhysicsMass(): number {
            return this.physicsImpostor.getParam("mass")
        }

        /**
         * @Deprecated. Use getPhysicsImpostor().getParam("friction");
         */
        public getPhysicsFriction(): number {
            return this.physicsImpostor.getParam("friction")
        }

        /**
         * @Deprecated. Use getPhysicsImpostor().getParam("restitution");
         */
        public getPhysicsRestitution(): number {
            return this.physicsImpostor.getParam("restitution")
        }

        public getPositionInCameraSpace(camera?: Camera): Vector3 {
            if (!camera) {
                camera = this.getScene().activeCamera;
            }

            return Vector3.TransformCoordinates(this.absolutePosition, camera.getViewMatrix());
        }

        public getDistanceToCamera(camera?: Camera): number {
            if (!camera) {
                camera = this.getScene().activeCamera;
            }

            return this.absolutePosition.subtract(camera.position).length();
        }

        public applyImpulse(force: Vector3, contactPoint: Vector3): void {
            if (!this.physicsImpostor) {
                return;
            }

            this.physicsImpostor.applyImpulse(force, contactPoint);
        }

        public setPhysicsLinkWith(otherMesh: Mesh, pivot1: Vector3, pivot2: Vector3, options?: any): void {
            if (!this.physicsImpostor || !otherMesh.physicsImpostor) {
                return;
            }

            this.physicsImpostor.createJoint(otherMesh.physicsImpostor, PhysicsJoint.HingeJoint, {
                mainPivot: pivot1,
                connectedPivot: pivot2,
                nativeParams: options
            })
        }

        /**
         * @Deprecated
         */
        public updatePhysicsBodyPosition(): void {
            Tools.Warn("updatePhysicsBodyPosition() is deprecated, please use updatePhysicsBody()");
            this.updatePhysicsBody();
        }

        /**
         * @Deprecated
         * Calling this function is not needed anymore. 
         * The physics engine takes care of transofmration automatically.
         */
        public updatePhysicsBody(): void {
            //Unneeded
        }


        // Collisions

        /**
         * Property checkCollisions : Boolean, whether the camera should check the collisions against the mesh.  
         * Default `false`.
         */
        public get checkCollisions(): boolean {
            return this._checkCollisions;
        }

        public set checkCollisions(collisionEnabled: boolean) {
            this._checkCollisions = collisionEnabled;
            if (this.getScene().workerCollisions) {
                this.getScene().collisionCoordinator.onMeshUpdated(this);
            }
        }

        public moveWithCollisions(velocity: Vector3): void {
            var globalPosition = this.getAbsolutePosition();

            globalPosition.subtractFromFloatsToRef(0, this.ellipsoid.y, 0, this._oldPositionForCollisions);
            this._oldPositionForCollisions.addInPlace(this.ellipsoidOffset);
            this._collider.radius = this.ellipsoid;

            this.getScene().collisionCoordinator.getNewPosition(this._oldPositionForCollisions, velocity, this._collider, 3, this, this._onCollisionPositionChange, this.uniqueId);
        }

        private _onCollisionPositionChange = (collisionId: number, newPosition: Vector3, collidedMesh: AbstractMesh = null) => {
            //TODO move this to the collision coordinator!
            if (this.getScene().workerCollisions)
                newPosition.multiplyInPlace(this._collider.radius);

            newPosition.subtractToRef(this._oldPositionForCollisions, this._diffPositionForCollisions);

            if (this._diffPositionForCollisions.length() > Engine.CollisionsEpsilon) {
                this.position.addInPlace(this._diffPositionForCollisions);
            }

            if (collidedMesh) {
                this.onCollideObservable.notifyObservers(collidedMesh);
            }

            this.onCollisionPositionChangeObservable.notifyObservers(this.position);
        }

        // Submeshes octree

        /**
        * This function will create an octree to help to select the right submeshes for rendering, picking and collision computations.  
        * Please note that you must have a decent number of submeshes to get performance improvements when using an octree.  
        */
        public createOrUpdateSubmeshesOctree(maxCapacity = 64, maxDepth = 2): Octree<SubMesh> {
            if (!this._submeshesOctree) {
                this._submeshesOctree = new Octree<SubMesh>(Octree.CreationFuncForSubMeshes, maxCapacity, maxDepth);
            }

            this.computeWorldMatrix(true);

            // Update octree
            var bbox = this.getBoundingInfo().boundingBox;
            this._submeshesOctree.update(bbox.minimumWorld, bbox.maximumWorld, this.subMeshes);

            return this._submeshesOctree;
        }

        // Collisions
        public _collideForSubMesh(subMesh: SubMesh, transformMatrix: Matrix, collider: Collider): void {
            this._generatePointsArray();
            // Transformation
            if (!subMesh._lastColliderWorldVertices || !subMesh._lastColliderTransformMatrix.equals(transformMatrix)) {
                subMesh._lastColliderTransformMatrix = transformMatrix.clone();
                subMesh._lastColliderWorldVertices = [];
                subMesh._trianglePlanes = [];
                var start = subMesh.verticesStart;
                var end = (subMesh.verticesStart + subMesh.verticesCount);
                for (var i = start; i < end; i++) {
                    subMesh._lastColliderWorldVertices.push(Vector3.TransformCoordinates(this._positions[i], transformMatrix));
                }
            }
            // Collide
            collider._collide(subMesh._trianglePlanes, subMesh._lastColliderWorldVertices, this.getIndices(), subMesh.indexStart, subMesh.indexStart + subMesh.indexCount, subMesh.verticesStart, !!subMesh.getMaterial());
            if (collider.collisionFound) {
                collider.collidedMesh = this;
            }
        }

        public _processCollisionsForSubMeshes(collider: Collider, transformMatrix: Matrix): void {
            var subMeshes: SubMesh[];
            var len: number;

            // Octrees
            if (this._submeshesOctree && this.useOctreeForCollisions) {
                var radius = collider.velocityWorldLength + Math.max(collider.radius.x, collider.radius.y, collider.radius.z);
                var intersections = this._submeshesOctree.intersects(collider.basePointWorld, radius);

                len = intersections.length;
                subMeshes = intersections.data;
            } else {
                subMeshes = this.subMeshes;
                len = subMeshes.length;
            }

            for (var index = 0; index < len; index++) {
                var subMesh = subMeshes[index];

                // Bounding test
                if (len > 1 && !subMesh._checkCollision(collider))
                    continue;

                this._collideForSubMesh(subMesh, transformMatrix, collider);
            }
        }

        public _checkCollision(collider: Collider): void {
            // Bounding box test
            if (!this._boundingInfo._checkCollision(collider))
                return;

            // Transformation matrix
            Matrix.ScalingToRef(1.0 / collider.radius.x, 1.0 / collider.radius.y, 1.0 / collider.radius.z, this._collisionsScalingMatrix);
            this.worldMatrixFromCache.multiplyToRef(this._collisionsScalingMatrix, this._collisionsTransformMatrix);

            this._processCollisionsForSubMeshes(collider, this._collisionsTransformMatrix);
        }

        // Picking
        public _generatePointsArray(): boolean {
            return false;
        }

        /**
         * Checks if the passed Ray intersects with the mesh.  
         * Returns an object PickingInfo.
         */
        public intersects(ray: Ray, fastCheck?: boolean): PickingInfo {
            var pickingInfo = new PickingInfo();

            if (!this.subMeshes || !this._boundingInfo || !ray.intersectsSphere(this._boundingInfo.boundingSphere) || !ray.intersectsBox(this._boundingInfo.boundingBox)) {
                return pickingInfo;
            }

            if (!this._generatePointsArray()) {
                return pickingInfo;
            }

            var intersectInfo: IntersectionInfo = null;

            // Octrees
            var subMeshes: SubMesh[];
            var len: number;

            if (this._submeshesOctree && this.useOctreeForPicking) {
                var worldRay = Ray.Transform(ray, this.getWorldMatrix());
                var intersections = this._submeshesOctree.intersectsRay(worldRay);

                len = intersections.length;
                subMeshes = intersections.data;
            } else {
                subMeshes = this.subMeshes;
                len = subMeshes.length;
            }

            for (var index = 0; index < len; index++) {
                var subMesh = subMeshes[index];

                // Bounding test
                if (len > 1 && !subMesh.canIntersects(ray))
                    continue;

                var currentIntersectInfo = subMesh.intersects(ray, this._positions, this.getIndices(), fastCheck);

                if (currentIntersectInfo) {
                    if (fastCheck || !intersectInfo || currentIntersectInfo.distance < intersectInfo.distance) {
                        intersectInfo = currentIntersectInfo;
                        intersectInfo.subMeshId = index;

                        if (fastCheck) {
                            break;
                        }
                    }
                }
            }

            if (intersectInfo) {
                // Get picked point
                var world = this.getWorldMatrix();
                var worldOrigin = Vector3.TransformCoordinates(ray.origin, world);
                var direction = ray.direction.clone();
                direction = direction.scale(intersectInfo.distance);
                var worldDirection = Vector3.TransformNormal(direction, world);

                var pickedPoint = worldOrigin.add(worldDirection);

                // Return result
                pickingInfo.hit = true;
                pickingInfo.distance = Vector3.Distance(worldOrigin, pickedPoint);
                pickingInfo.pickedPoint = pickedPoint;
                pickingInfo.pickedMesh = this;
                pickingInfo.bu = intersectInfo.bu;
                pickingInfo.bv = intersectInfo.bv;
                pickingInfo.faceId = intersectInfo.faceId;
                pickingInfo.subMeshId = intersectInfo.subMeshId;
                return pickingInfo;
            }

            return pickingInfo;
        }

        /**
         * Clones the mesh, used by the class Mesh.  
         * Just returns `null` for an AbstractMesh.  
         */
        public clone(name: string, newParent: Node, doNotCloneChildren?: boolean): AbstractMesh {
            return null;
        }

        /**
         * Disposes all the mesh submeshes.  
         * Returns nothing.  
         */
        public releaseSubMeshes(): void {
            if (this.subMeshes) {
                while (this.subMeshes.length) {
                    this.subMeshes[0].dispose();
                }
            } else {
                this.subMeshes = new Array<SubMesh>();
            }
        }

        /**
         * Disposes the AbstractMesh.  
         * Some internal references are kept for further use.  
         * By default, all the mesh children are also disposed unless the parameter `doNotRecurse` is set to `true`.  
         * Returns nothing.  
         */
        public dispose(doNotRecurse?: boolean): void {
            var index: number;

            // Action manager
            if (this.actionManager) {
                this.actionManager.dispose();
                this.actionManager = null;
            }

            // Skeleton
            this.skeleton = null;

            // Animations
            this.getScene().stopAnimation(this);

            // Physics
            if (this.physicsImpostor) {
                this.physicsImpostor.dispose(/*!doNotRecurse*/);
            }

            // Intersections in progress
            for (index = 0; index < this._intersectionsInProgress.length; index++) {
                var other = this._intersectionsInProgress[index];

                var pos = other._intersectionsInProgress.indexOf(this);
                other._intersectionsInProgress.splice(pos, 1);
            }

            this._intersectionsInProgress = [];

            // Lights
            var lights = this.getScene().lights;

            lights.forEach((light: Light) => {
                var meshIndex = light.includedOnlyMeshes.indexOf(this);

                if (meshIndex !== -1) {
                    light.includedOnlyMeshes.splice(meshIndex, 1);
                }

                meshIndex = light.excludedMeshes.indexOf(this);

                if (meshIndex !== -1) {
                    light.excludedMeshes.splice(meshIndex, 1);
                }

                // Shadow generators
                var generator = light.getShadowGenerator();
                if (generator) {
                    meshIndex = generator.getShadowMap().renderList.indexOf(this);

                    if (meshIndex !== -1) {
                        generator.getShadowMap().renderList.splice(meshIndex, 1);
                    }
                }
            });

            // Edges
            if (this._edgesRenderer) {
                this._edgesRenderer.dispose();
                this._edgesRenderer = null;
            }

            // SubMeshes
            if (this.getClassName() !== "InstancedMesh"){
                this.releaseSubMeshes();
            }

            // Engine
            this.getScene().getEngine().wipeCaches();

            // Remove from scene
            this.getScene().removeMesh(this);

            if (!doNotRecurse) {
                // Particles
                for (index = 0; index < this.getScene().particleSystems.length; index++) {
                    if (this.getScene().particleSystems[index].emitter === this) {
                        this.getScene().particleSystems[index].dispose();
                        index--;
                    }
                }

                // Children
                var objects = this.getDescendants(true);
                for (index = 0; index < objects.length; index++) {
                    objects[index].dispose();
                }
            } else {
                var childMeshes = this.getChildMeshes(true);
                for (index = 0; index < childMeshes.length; index++) {
                    var child = childMeshes[index];
                    child.parent = null;
                    child.computeWorldMatrix(true);
                }
            }

            // facet data
            if (this._facetDataEnabled) {
                this.disableFacetData();
            }

            this.onAfterWorldMatrixUpdateObservable.clear();
            this.onCollideObservable.clear();
            this.onCollisionPositionChangeObservable.clear();

            this._isDisposed = true;

            super.dispose();
        }

        /**
         * Returns a new Vector3 what is the localAxis, expressed in the mesh local space, rotated like the mesh.  
         * This Vector3 is expressed in the World space.  
         */
        public getDirection(localAxis:Vector3): Vector3 {
            var result = Vector3.Zero();

            this.getDirectionToRef(localAxis, result);
            
            return result;
        }

        /**
         * Sets the Vector3 "result" as the rotated Vector3 "localAxis" in the same rotation than the mesh.
         * localAxis is expressed in the mesh local space.
         * result is computed in the Wordl space from the mesh World matrix.
         * Returns nothing.  
         */
        public getDirectionToRef(localAxis:Vector3, result:Vector3): void {
            Vector3.TransformNormalToRef(localAxis, this.getWorldMatrix(), result);
        }

        public setPivotPoint(point:Vector3, space:Space = Space.LOCAL): void{

            if(this.getScene().getRenderId() == 0){
                this.computeWorldMatrix(true);
            }

            var wm = this.getWorldMatrix();
            
            if (space == Space.WORLD) {
                var tmat = Tmp.Matrix[0];
                wm.invertToRef(tmat);
                point = Vector3.TransformCoordinates(point, tmat);
            }

            Vector3.TransformCoordinatesToRef(point, wm, this.position);

            this._pivotMatrix.m[12] = -point.x;
            this._pivotMatrix.m[13] = -point.y;
            this._pivotMatrix.m[14] = -point.z;

            this._cache.pivotMatrixUpdated = true;

        }

        /**
         * Returns a new Vector3 set with the mesh pivot point coordinates in the local space.  
         */
        public getPivotPoint(): Vector3 {
            var point = Vector3.Zero();
            this.getPivotPointToRef(point);
            return point;
        }

        /**
         * Sets the passed Vector3 "result" with the coordinates of the mesh pivot point in the local space.  
         */
        public getPivotPointToRef(result:Vector3): void{
            result.x = -this._pivotMatrix.m[12];
            result.y = -this._pivotMatrix.m[13];
            result.z = -this._pivotMatrix.m[14];
        }

        /**
         * Returns a new Vector3 set with the mesh pivot point World coordinates.  
         */
        public getAbsolutePivotPoint(): Vector3 {
            var point = Vector3.Zero();
            this.getAbsolutePivotPointToRef(point);
            return point;
        }

        /**
         * Defines the passed mesh as the parent of the current mesh.  
         * If keepWorldPositionRotation is set to `true` (default `false`), the current mesh position and rotation are kept.
         * Returns nothing.  
         */
        public setParent(mesh:AbstractMesh, keepWorldPositionRotation = false): void{

            var child = this;
            var parent = mesh;

            if(mesh == null){

                if(child.parent && keepWorldPositionRotation){
                  
                    var rotation = Tmp.Quaternion[0];
                    var position = Tmp.Vector3[0];
                    var scale = Tmp.Vector3[1];

                    child.getWorldMatrix().decompose(scale, rotation, position);

                    if (child.rotationQuaternion) {
                        child.rotationQuaternion.copyFrom(rotation);
                    } else {
                        rotation.toEulerAnglesToRef(child.rotation);
                    }

                    child.position.x = position.x;
                    child.position.y = position.y;
                    child.position.z = position.z;

               }

            } else {

                if(keepWorldPositionRotation){
                    
                    var rotation = Tmp.Quaternion[0];
                    var position = Tmp.Vector3[0];
                    var scale = Tmp.Vector3[1];
                    var m1 = Tmp.Matrix[0];
                    var m2 = Tmp.Matrix[1];

                    parent.getWorldMatrix().decompose(scale, rotation, position);

                    rotation.toRotationMatrix(m1);
                    m2.setTranslation(position);

                    m2.multiplyToRef(m1, m1);

                    var invParentMatrix = Matrix.Invert(m1);

                    var m = child.getWorldMatrix().multiply(invParentMatrix);

                    m.decompose(scale, rotation, position);

                    if (child.rotationQuaternion) {
                        child.rotationQuaternion.copyFrom(rotation);
                    } else {
                        rotation.toEulerAnglesToRef(child.rotation);
                    }

                    invParentMatrix = Matrix.Invert(parent.getWorldMatrix());

                    var m = child.getWorldMatrix().multiply(invParentMatrix);

                    m.decompose(scale, rotation, position);

                    child.position.x = position.x;
                    child.position.y = position.y;
                    child.position.z = position.z;

                }

            }
            child.parent = parent;
        }

        /**
         * Adds the passed mesh as a child to the current mesh.  
         * If keepWorldPositionRotation is set to `true` (default `false`), the child world position and rotation are kept.  
         * Returns nothing.  
         */
        public addChild(mesh:AbstractMesh, keepWorldPositionRotation = false): void{
            mesh.setParent(this, keepWorldPositionRotation);
        }

        /**
         * Removes the passed mesh from the current mesh children list.  
         */
        public removeChild(mesh:AbstractMesh, keepWorldPositionRotation = false): void{
            mesh.setParent(null, keepWorldPositionRotation);
        }

        /**
         * Sets the Vector3 "result" coordinates with the mesh pivot point World coordinates.  
         */
        public getAbsolutePivotPointToRef(result:Vector3): void{
            result.x = this._pivotMatrix.m[12];
            result.y = this._pivotMatrix.m[13];
            result.z = this._pivotMatrix.m[14];
            this.getPivotPointToRef(result);
            Vector3.TransformCoordinatesToRef(result, this.getWorldMatrix(), result);
        }

       // Facet data
        /** 
         *  Initialize the facet data arrays : facetNormals, facetPositions and facetPartitioning
         */
        private _initFacetData(): AbstractMesh {
            if (!this._facetNormals) {
                this._facetNormals = new Array<Vector3>();
            }
            if (!this._facetPositions) {
                this._facetPositions = new Array<Vector3>();
            }
            if (!this._facetPartitioning) {
                this._facetPartitioning = new Array<number[]>();
            }
            this._facetNb = this.getIndices().length / 3;
            this._partitioningSubdivisions = (this._partitioningSubdivisions) ? this._partitioningSubdivisions : 10;   // default nb of partitioning subdivisions = 10
            this._partitioningBBoxRatio = (this._partitioningBBoxRatio) ? this._partitioningBBoxRatio : 1.01;          // default ratio 1.01 = the partitioning is 1% bigger than the bounding box
            for (var f = 0; f < this._facetNb; f++) {
                this._facetNormals[f] = Vector3.Zero();
                this._facetPositions[f] = Vector3.Zero();
            }
            this._facetDataEnabled = true;           
            return this;
        }

        /**
         * Updates the mesh facetData arrays and the internal partitioning when the mesh is morphed or updated.  
         * This method can be called within the render loop.  
         * You don't need to call this method by yourself in the render loop when you update/morph a mesh with the methods CreateXXX() as they automatically manage this computation.  
         */
        public updateFacetData(): AbstractMesh {
            if (!this._facetDataEnabled) {
                this._initFacetData();
            }
            var positions = this.getVerticesData(VertexBuffer.PositionKind);
            var indices = this.getIndices();
            var normals = this.getVerticesData(VertexBuffer.NormalKind);
            var bInfo = this.getBoundingInfo();
            this._bbSize.x = (bInfo.maximum.x - bInfo.minimum.x > Epsilon) ? bInfo.maximum.x - bInfo.minimum.x : Epsilon;
            this._bbSize.y = (bInfo.maximum.y - bInfo.minimum.y > Epsilon) ? bInfo.maximum.y - bInfo.minimum.y : Epsilon;
            this._bbSize.z = (bInfo.maximum.z - bInfo.minimum.z > Epsilon) ? bInfo.maximum.z - bInfo.minimum.z : Epsilon;
            var bbSizeMax = (this._bbSize.x > this._bbSize.y) ? this._bbSize.x : this._bbSize.y;
            bbSizeMax = (bbSizeMax > this._bbSize.z) ? bbSizeMax : this._bbSize.z;
            this._subDiv.max = this._partitioningSubdivisions;
            this._subDiv.X = Math.floor(this._subDiv.max * this._bbSize.x / bbSizeMax);   // adjust the number of subdivisions per axis
            this._subDiv.Y = Math.floor(this._subDiv.max * this._bbSize.y / bbSizeMax);   // according to each bbox size per axis
            this._subDiv.Z = Math.floor(this._subDiv.max * this._bbSize.z / bbSizeMax);
            this._subDiv.X = this._subDiv.X < 1 ? 1 : this._subDiv.X;                     // at least one subdivision
            this._subDiv.Y = this._subDiv.Y < 1 ? 1 : this._subDiv.Y;
            this._subDiv.Z = this._subDiv.Z < 1 ? 1 : this._subDiv.Z;
            // set the parameters for ComputeNormals()
            this._facetParameters.facetNormals = this.getFacetLocalNormals(); 
            this._facetParameters.facetPositions = this.getFacetLocalPositions();
            this._facetParameters.facetPartitioning = this.getFacetLocalPartitioning();
            this._facetParameters.bInfo = bInfo;
            this._facetParameters.bbSize = this._bbSize;
            this._facetParameters.subDiv = this._subDiv;
            this._facetParameters.ratio = this.partitioningBBoxRatio;
            VertexData.ComputeNormals(positions, indices, normals, this._facetParameters);
            return this;
        }
        /**
         * Returns the facetLocalNormals array.  
         * The normals are expressed in the mesh local space.  
         */
        public getFacetLocalNormals(): Vector3[] {
            if (!this._facetNormals) {
                this.updateFacetData();
            }
            return this._facetNormals;
        }
        /**
         * Returns the facetLocalPositions array.  
         * The facet positions are expressed in the mesh local space.  
         */
        public getFacetLocalPositions(): Vector3[] {
            if (!this._facetPositions) {
                this.updateFacetData();
            }
            return this._facetPositions;           
        }
        /**
         * Returns the facetLocalPartioning array
         */
        public getFacetLocalPartitioning(): number[][] {
            if (!this._facetPartitioning) {
                this.updateFacetData();
            }
            return this._facetPartitioning;
        }
        /**
         * Returns the i-th facet position in the world system.  
         * This method allocates a new Vector3 per call.  
         */
        public getFacetPosition(i: number): Vector3 {
            var pos = Vector3.Zero();
            this.getFacetPositionToRef(i, pos);
            return pos;
        }
        /**
         * Sets the reference Vector3 with the i-th facet position in the world system.  
         * Returns the mesh.  
         */
        public getFacetPositionToRef(i: number, ref: Vector3): AbstractMesh {
            var localPos = (this.getFacetLocalPositions())[i];
            var world = this.getWorldMatrix();
            Vector3.TransformCoordinatesToRef(localPos, world, ref);
            return this;
        }
        /**
         * Returns the i-th facet normal in the world system.  
         * This method allocates a new Vector3 per call.  
         */
        public getFacetNormal(i: number): Vector3 {
            var norm = Vector3.Zero();
            this.getFacetNormalToRef(i, norm);
            return norm;
        }
        /**
         * Sets the reference Vector3 with the i-th facet normal in the world system.  
         * Returns the mesh.  
         */
        public getFacetNormalToRef(i: number, ref: Vector3) {
            var localNorm = (this.getFacetLocalNormals())[i];
            Vector3.TransformNormalToRef(localNorm, this.getWorldMatrix(), ref);
            return this;
        }
        /** 
         * Returns the facets (in an array) in the same partitioning block than the one the passed coordinates are located (expressed in the mesh local system).
         */
        public getFacetsAtLocalCoordinates(x: number, y: number, z: number): number[] {
            var bInfo = this.getBoundingInfo();
            var ox = Math.floor((x - bInfo.minimum.x * this._partitioningBBoxRatio) * this._subDiv.X * this._partitioningBBoxRatio / this._bbSize.x);
            var oy = Math.floor((y - bInfo.minimum.y * this._partitioningBBoxRatio) * this._subDiv.Y * this._partitioningBBoxRatio / this._bbSize.y);
            var oz = Math.floor((z - bInfo.minimum.z * this._partitioningBBoxRatio) * this._subDiv.Z * this._partitioningBBoxRatio / this._bbSize.z);
            if (ox < 0 || ox > this._subDiv.max || oy < 0 || oy > this._subDiv.max || oz < 0 || oz > this._subDiv.max) {
                return null;
            }
            return this._facetPartitioning[ox + this._subDiv.max * oy + this._subDiv.max * this._subDiv.max * oz];
        }
        /** 
         * Returns the closest mesh facet index at (x,y,z) World coordinates, null if not found.  
         * If the parameter projected (vector3) is passed, it is set as the (x,y,z) World projection on the facet.  
         * If checkFace is true (default false), only the facet "facing" to (x,y,z) or only the ones "turning their backs", according to the parameter "facing" are returned.
         * If facing and checkFace are true, only the facet "facing" to (x, y, z) are returned : positive dot (x, y, z) * facet position.
         * If facing si false and checkFace is true, only the facet "turning their backs" to (x, y, z) are returned : negative dot (x, y, z) * facet position. 
         */
        public getClosestFacetAtCoordinates(x: number, y: number, z: number, projected?: Vector3, checkFace: boolean = false, facing: boolean = true): number {
            var world = this.getWorldMatrix();
            var invMat = Tmp.Matrix[5];
            world.invertToRef(invMat);
            var invVect = Tmp.Vector3[8];
            var closest = null;
            Vector3.TransformCoordinatesFromFloatsToRef(x, y, z, invMat, invVect);  // transform (x,y,z) to coordinates in the mesh local space
            closest = this.getClosestFacetAtLocalCoordinates(invVect.x, invVect.y, invVect.z, projected, checkFace, facing);
            if (projected) {
                // tranform the local computed projected vector to world coordinates
                Vector3.TransformCoordinatesFromFloatsToRef(projected.x, projected.y, projected.z, world, projected);
            }
            return closest;
        }
        /** 
         * Returns the closest mesh facet index at (x,y,z) local coordinates, null if not found.   
         * If the parameter projected (vector3) is passed, it is set as the (x,y,z) local projection on the facet.  
         * If checkFace is true (default false), only the facet "facing" to (x,y,z) or only the ones "turning their backs", according to the parameter "facing" are returned.
         * If facing and checkFace are true, only the facet "facing" to (x, y, z) are returned : positive dot (x, y, z) * facet position.
         * If facing si false and checkFace is true, only the facet "turning their backs"  to (x, y, z) are returned : negative dot (x, y, z) * facet position.
         */
        public getClosestFacetAtLocalCoordinates(x: number, y: number, z: number, projected?: Vector3, checkFace: boolean = false, facing: boolean = true): number {
            var closest = null;
            var tmpx = 0.0;         
            var tmpy = 0.0;
            var tmpz = 0.0;
            var d = 0.0;            // tmp dot facet normal * facet position
            var t0 = 0.0;
            var projx = 0.0;
            var projy = 0.0;
            var projz = 0.0;
            // Get all the facets in the same partitioning block than (x, y, z)
            var facetPositions = this.getFacetLocalPositions();
            var facetNormals = this.getFacetLocalNormals();
            var facetsInBlock = this.getFacetsAtLocalCoordinates(x, y, z);
            if (!facetsInBlock) {
                return null;
            }
            // Get the closest facet to (x, y, z)
            var shortest = Number.MAX_VALUE;            // init distance vars
            var tmpDistance = shortest;
            var fib;                                    // current facet in the block
            var norm;                                   // current facet normal
            var p0;                                     // current facet barycenter position
            // loop on all the facets in the current partitioning block
            for (var idx = 0; idx < facetsInBlock.length; idx++) {
                fib = facetsInBlock[idx];           
                norm = facetNormals[fib];
                p0 = facetPositions[fib];

                d = (x - p0.x) * norm.x + (y - p0.y) * norm.y + (z - p0.z) * norm.z;
                if ( !checkFace || (checkFace && facing && d >= 0.0) || (checkFace && !facing && d <= 0.0) ) {
                    // compute (x,y,z) projection on the facet = (projx, projy, projz)
                    d = norm.x * p0.x + norm.y * p0.y + norm.z * p0.z; 
                    t0 = -(norm.x * x + norm.y * y + norm.z * z - d) / (norm.x * norm.x + norm.y * norm.y + norm.z * norm.z);
                    projx = x + norm.x * t0;
                    projy = y + norm.y * t0;
                    projz = z + norm.z * t0;

                    tmpx = projx - x;
                    tmpy = projy - y;
                    tmpz = projz - z;
                    tmpDistance = tmpx * tmpx + tmpy * tmpy + tmpz * tmpz;             // compute length between (x, y, z) and its projection on the facet
                    if (tmpDistance < shortest) {                                      // just keep the closest facet to (x, y, z)
                        shortest = tmpDistance;
                        closest = fib; 
                        if (projected) {
                            projected.x = projx;
                            projected.y = projy;
                            projected.z = projz;
                        }
                    }
                }
            }
            return closest;
        }
        /**
         * Returns the object "parameter" set with all the expected parameters for facetData computation by ComputeNormals()  
         */
        public getFacetDataParameters(): any {
            return this._facetParameters;
        }
        /** 
         * Disables the feature FacetData and frees the related memory.  
         * Returns the mesh.  
         */
        public disableFacetData(): AbstractMesh {
            if (this._facetDataEnabled) {
                this._facetDataEnabled = false;
                this._facetPositions = null;
                this._facetNormals = null;
                this._facetPartitioning = null;
                this._facetParameters = null;
            }
            return this;
        } 

    }
}

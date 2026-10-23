# 3D GIS Movement & Polygon Animation Implementation Guide
**SmartLivestock — Municipal Agriculture Office of Padre Garcia, Batangas**  
*Location: `frontend/src/components/gis/3D_GIS_IMPLEMENTATION_GUIDE.md`*

---

## 1. Overview & Context

In the SmartLivestock information system, the **GIS (Geographic Information System)** module provides real-time geographic telemetry for livestock population, disease surveillance, and movement permits.

When operating in **3D View Mode** on the **Livestock Movement layer**, agricultural officers inspect two distinct types of data:
1. **Volumetric Height Density**: Extruded 3D columns representing the volume of livestock movements per barangay.
2. **Inter-Barangay & Regional Transit Lines**: 3D parabolic flight arcs depicting livestock transports leaving Padre Garcia to destinations across the Philippines (Mindoro, Quezon, Batangas City, etc.).

### The Problem
When both tall 3D columns and flight arcs were rendered simultaneously, the towering 3D columns obstructed the flight lines and covered the destination beacon labels. 

Furthermore, switching to movement lines needed to smoothly **shrink the 3D polygon columns down to the ground** so that the transit arcs and landing destination pins take center stage, while preserving the barangays' choropleth colors.

---

## 2. Architecture & Component Roles

The implementation spans three primary components:

```text
┌────────────────────────────────────────────────────────┐
│             RoleAwareGISContainer.tsx                  │
│  - Holds `movementDisplayMode`: 'lines'|'density'|'both'
│  - Manages permissions and user barangay scope         │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐   ┌──────────────────────────┐
│     GISControls.tsx     │   │       GISMap.tsx         │
│ - 3D Toggle Segment:    │   │ - Bridges 2D Leaflet and │
│   [Lines -> Destination]│   │   3D Giro3D views        │
│   [Height Density]      │   └────────────┬─────────────┘
│   [Both]                │                │
│ - Only shown when:      │                ▼
│   viewMode === '3D' &&  │   ┌──────────────────────────┐
│   currentLayer ===      │   │  Giro3DBarangayView.tsx  │
│   'movement'            │   │ - Three.js WebGL Scene   │
└─────────────────────────┘   │ - FeatureCollection mesh │
                              │ - Outlines & Parabolic   │
                              │   Flight Arcs            │
                              │ - 60fps Shrink Animation │
                              └──────────────────────────┘
```

### Component Details
1. **`RoleAwareGISContainer.tsx`**:
   - Manages the active GIS layer (`cattle`, `disease`, `movement`, etc.) and `movementDisplayMode` state (`'lines' | 'density' | 'both'`).
2. **`GISControls.tsx`**:
   - Renders the floating HUD command bar.
   - Conditionally renders the 3D segmented toggle switch **only** when `viewMode === '3D' && currentLayer === 'movement'`.
3. **`Giro3DBarangayView.tsx`**:
   - The core WebGL engine powered by **Giro3D** and **Three.js**.
   - Handles GeoJSON polygon tessellation, vertex buffers, border wireframes, parabolic tube geometry, animated pulse particles, and dynamic height easing.

---

## 3. The 3 Technical Bugs We Solved

### Bug 1: The "Two Polygons" Bug (Wireframe Separated from Solid Fill)
- **Symptom**: When moving the height scale slider, two polygons appeared: one solid polygon frozen at the bottom without an outline, and an outline wireframe floating above it.
- **Root Cause**: An early attempt cached the extrusion height in `extrusionOffset`:
  ```typescript
  // BAD: Cached initial height forever
  const cached = fullExtrusionHeightsRef.current.get(feature);
  if (cached) return cached;
  ```
  When the slider moved, Giro3D's `updateStyles()` called `extrusionOffset`, which returned the old cached height (e.g. 1500). Giro3D left the solid mesh at 1500. Meanwhile, our custom outline loop multiplied the line vertices by the slider ratio (e.g. 3000). The outline separated from the mesh, appearing as two separate objects!
- **Solution**: Removed the cache. `extrusionOffset` dynamically returns `getExtrusionHeight(..., heightScaleRef.current)`. Both Giro3D's filled mesh and our outline buffer recalculate from the exact same dynamic formula in lockstep.

---

### Bug 2: "Only the Labels Moved, Polygons Didn't Shrink"
- **Symptom**: Clicking `Lines -> Destination` made the CSS HTML labels glide down to the ground, but the 3D polygon columns and outlines stayed completely still in WebGL.
- **Root Cause (3 compounded issues)**:
  1. **Asynchronous Tile Tessellation**: In `initialize()`, we ran `featureCollection.traverse()` immediately after `await instance.add(featureCollection)`. However, Giro3D builds tile meshes **asynchronously** during its first render pass. In `initialize()`, the mesh collection was completely empty (`0` meshes cached)! When the animation loop ran, it was iterating over an empty list.
  2. **`matrixWorldAutoUpdate = false`**: Giro3D disables `matrixWorldAutoUpdate` on the Three.js `Scene` (`instance.scene.matrixWorldAutoUpdate = false`) for performance. When calling `object.scale.setZ(scaleZ)`, Three.js never propagated the new scale down into `matrixWorld`.
  3. **Parent Hierarchy Lock**: Each `SurfaceMesh` is a child of a `PolygonMesh` whose `matrixAutoUpdate` is also `false`. Without explicitly forcing `updateMatrixWorld(true)` on both child and parent, the GPU vertex shader never received the new model-view matrix.
- **Solution**:
  1. Enabled auto-matrix updates: `instance.scene.matrixWorldAutoUpdate = true;`.
  2. Dynamically traversed the collection inside the animation loop by **lowercase barangay name**, ensuring 100% of live `SurfaceMesh` objects are found.
  3. Upgraded `setVerticalScale`:
     ```typescript
     function setVerticalScale(object: Object3D, scale: number): void {
       object.scale.setZ(scale);
       object.updateMatrix();
       object.matrixWorldNeedsUpdate = true;
       object.updateMatrixWorld(true);
       if (object.parent) {
         object.parent.matrixWorldNeedsUpdate = true;
         object.parent.updateMatrixWorld(true);
       }
     }
     ```
  4. Forced WebGL canvas repainting on each animation frame by passing the camera: `instance.notifyChange(instance.view.camera);`.

---

### Bug 3: UI Naming Clarification
- **Symptom**: The button was previously labeled `Lines (Color Density)`.
- **User Correction**: "LINES -> IS NOT COLOR DENSITY ITS DESTINATION"
- **Solution**: The first button is strictly for viewing transit lines to destinations: **`Lines -> Destination`**. When clicked, the 3D columns shrink flat to height 2 (a thin ground plate), clearing line-of-sight for flight lines and destination beacons while keeping the underlying choropleth color density on the ground.

---

## 4. Complete Data Flow & Animation Lifecycle

```text
User clicks [ 🚛 Lines -> Destination ]
                  │
                  ▼
GISControls calls onMovementDisplayModeChange('lines')
                  │
                  ▼
RoleAwareGISContainer updates `movementDisplayMode = 'lines'`
                  │
                  ▼
Giro3DBarangayView triggered via `useEffect([movementDisplayMode])`
                  │
                  ├─► 1. Read Current State:
                  │      - isFlat = true
                  │      - targetH = 2 (flat ground plate)
                  │      - startH = current displayed height (e.g. 1850)
                  │      - fullH = base metric extrusion height (1850)
                  │
                  ├─► 2. Query Live Meshes by Name:
                  │      - collection.traverse() finds live `SurfaceMesh` instances
                  │      - borderLinesByNameRef finds matching wireframe lines
                  │
                  ├─► 3. 500ms `requestAnimationFrame` Loop:
                  │      elapsed = now - startTime
                  │      progress = Math.min(1, elapsed / 500)
                  │      ease = 1 - Math.pow(1 - progress, 3)  (Cubic Ease-Out)
                  │
                  │      currentH = startH + (2 - startH) * ease
                  │      scaleZ = currentH / fullH
                  │
                  │      For each barangay:
                  │        • setVerticalScale(surfaceMesh, scaleZ)
                  │        • setVerticalScale(borderLines, scaleZ)
                  │        • syncLabelPositions() (CSS labels track roof)
                  │
                  │      instance.notifyChange(camera)  --> WebGL repaints frame
                  │
                  ▼
Result: Columns smoothly glide down into flat 2-unit floor tiles at 60 FPS
```

---

## 5. Key Software Engineering Concepts Explained

### 1. Affine Transformations & Three.js Matrix Hierarchy
In 3D graphics, an object's position, rotation, and scale in world space are calculated via matrices:
$$\text{MatrixWorld} = \text{Parent.MatrixWorld} \times \text{Local.Matrix}$$

```text
Scene (World Space)
  └── threeObjects (Group)
        └── borderLines (LineSegments: Z=0 to fullHeight) ──► scale.setZ(scaleZ)
  └── featureCollection (Group)
        └── tile (Group)
              └── PolygonMesh (Z=0)
                    └── SurfaceMesh (Mesh: Z=0 to fullHeight) ──► scale.setZ(scaleZ)
```
Because both `SurfaceMesh` and `borderLines` have their local origin at ground level ($Z = 0$), scaling their $Z$-axis by `scaleZ`:
- $Z = 0$ remains $0 \times \text{scaleZ} = 0$ (glued to the ground terrain).
- $Z = \text{fullHeight}$ becomes $\text{fullHeight} \times \text{scaleZ} = \text{currentHeight}$ (roof descends).
- Vertical wall edges scale proportionally from full height down to flat.

### 2. Cubic Ease-Out (`1 - (1 - t)^3`)
Linear animations ($current = start + (target - start) \times t$) look robotic and abrupt when they stop. We used a **Cubic Ease-Out**:
$$f(t) = 1 - (1 - t)^3$$
- When $t = 0$: $f(0) = 0$ (starts immediately with full speed).
- When $t = 0.5$: $f(0.5) = 1 - 0.125 = 0.875$ (87.5% of the distance covered in half the time).
- When $t = 1.0$: $f(1) = 1$ (gently decelerates to a soft stop).

### 3. GPU Matrix Transformation vs. CPU Buffer Re-allocation
- **Bad approach**: Re-triangulating polygons and creating `new Float32Array()` 60 times a second creates garbage collection pauses (jank) and high CPU load.
- **Our approach**: We construct full-height geometry buffers **once**. During animation, we only modify a single float (`scale.z`). The GPU transforms millions of vertex coordinates in parallel in the vertex shader:
  $$\vec{v}_{\text{screen}} = \mathbf{P} \times \mathbf{V} \times \mathbf{M} \times \vec{v}_{\text{local}}$$
  This runs smoothly at 60 FPS on any laptop or desktop.

---

## 6. Capstone Presentation & Defense Cheatsheet

If panelists ask about this implementation during your thesis defense, here is how to explain it:

| Panel Question | Best Technical Answer |
| :--- | :--- |
| **"Why do we need 3D GIS in addition to the 2D map?"** | "2D choropleths only show single-variable color density. 3D volumetric GIS allows comparing volume (extruded height) and category density simultaneously. For livestock movement, 3D parabolic arcs represent geographic transit corridors that would otherwise overlap and clutter a flat 2D map." |
| **"What happens when you switch to 'Lines -> Destination'?"** | "The system executes a 500ms cubic ease-out matrix interpolation that smoothly collapses the 3D polygon height down to 2 units on the ground. This eliminates visual occlusion so that flight lines and destination beacons are completely unobstructed." |
| **"Why did you use Three.js matrix scaling instead of regenerating geometries?"** | "Regenerating GeoJSON vertex buffers on every frame causes memory allocation overhead and frame drops. By scaling the Z-axis of the local transformation matrix and invalidating the scene's world matrix, the transformation is executed directly on the GPU at 60 FPS." |
| **"Does flattening the polygon remove the choropleth data?"** | "No. Giro3D's `SurfaceMesh` maintains its unshaded material fill color (`fill.color`). When scaled to a flat ground slab, 100% of the choropleth color density remains visible on the terrain." |
| **"What happens when a user clicks a transit line on the map?"** | "Raycasting picks the 3D arc tube/beacon, sets `selectedMovement` state, focuses the camera on the destination terminal, and automatically pulses the sidebar container and its Origin/Destination telemetry card with a 2-second glowing highlight animation." |

---

## 7. Map-to-Sidebar Line Selection Highlight Animation

When inspecting livestock transport permits, users click a transit line or destination beacon on the map. To deliver immediate, clear visual feedback across the application layers:

### Data Flow & Architecture
```text
User clicks 3D Arc / 2D Line
              │
              ├── Three.js Raycaster picks hitObj.userData.movement
              │
              ▼
   onSelectMovement(pickedMove)
              │
              ├── Sets selectedMovement in RoleAwareGISContainer
              │
              ▼
   GISSidebar (receives selectedMovement)
              │
              ├── Desktop <aside>: Plays `animate-sidebar-glow` (ring & blue shadow pulse)
              │
              └── Renders <MovementDetailsModal key={selectedMovement.id} ... />
                           │
                           ├── Header: Shimmer sweep gradient progress bar
                           ├── Banner: Pulsing ping beacon ("Map Line Selected #ID")
                           ├── Route Card: Glowing box-shadow pulse (`animate-line-highlight`)
                           └── Transit Flow: Animated truck & directional beam indicator
```

### Key Technical Mechanisms
1. **React Keyed Remounting (`key={selectedMovement.id}`)**:
   By keying `MovementDetailsModal` with `selectedMovement.id`, switching between line selections cleanly unmounts and remounts the modal DOM, guaranteeing all CSS entrance animations, shimmer bars, and scroll resets trigger reliably on every click.
2. **Cubic Easing Shadow Decay (`@keyframes line-selection-highlight`)**:
   Uses an expanding `box-shadow` pulse that starts at 0, blooms to a 35px cyan/blue halo with slight scale lift, and smoothly decays back to normal over 2 seconds (`cubic-bezier(0.16, 1, 0.3, 1)`).
3. **List Auto-Scroll (`scrollIntoView`)**:
   If the user views `MovementAnalysisPanel` or `MunicipalOverview`, clicking a line on the map automatically scrolls the matching permit row smoothly into view (`behavior: 'smooth', block: 'nearest'`) and applies the active line highlight ring.

---

*Authored for SmartLivestock GIS Developer Reference • Padre Garcia, Batangas*

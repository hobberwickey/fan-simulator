window.addEventListener("load", () => {
	App.init();
})

const App = {
	config: {
		// Number of blades
		blades: 8,
		// Number of rows of pixels per blade
		rows: 1,
		// Number of pixels in each row
		length: 360,
		// Rotational speed
		rpm: 40,
		// Fade factor between frames
		fade: 0.95,

		// Real world outer diameter of the fan (unit agnostic)
		oDiameter: 60,
		// Real world inner diameter of the fan blades
		iDiameter: 5.25,
		// Real world blade width (doesn't matter for one row per blade)
		bWidth: 1
	},

	consts: {
		ctx: null,
		src: null,
		diameter: 0,
		tau: Math.PI * 2,
		spin_rate: 0,
		blades: [],
		imgData: []
	},

	timer: null,
	angle: 0,
	tick: window.performance.now(),
	started: true,
	loaded: false,
	
	image: null,
	video: null,

	init: () => {
		// Build fanblades
		App.consts.ctx = document.querySelector("#fan").getContext('2d');
		App.consts.src = document.querySelector("#src").getContext('2d', { willReadFrequently: true });
		App.consts.diameter = window.innerHeight - 60;
		
		App.setSpinRate();
		App.createBlades();
		App.setBladeOffset();
		App.setBladePixels();

		let { ctx, diameter } = App.consts;

		ctx.canvas.height = diameter;
		ctx.canvas.width = diameter;

		ctx.canvas.style.transformOrigin = `${ diameter / 2 }px ${ diameter / 2 }px`;
		ctx.canvas.style.transform = 'rotate3d(0, 0, 1, 0rad)';

		App.consts.imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);

		// Setup some html events for img and video loading
		App.setupLoad()

		//Start Rotation
		window.requestAnimationFrame(App.spin);

		// Start draw loop
		// this.timer = setInterval(App.draw, 1000 / App.config.rate);
		

		// Setup Image Preview
		document.querySelector("#upload").addEventListener("change", App.loadSrc);
	},

	spin: () => {
		if (App.started) {
			let { tick, angle, spin } = App;
			let { tau, spin_rate, ctx } = App.consts; 
			let now = window.performance.now()
			let diff = now - tick;
			
			App.tick = now;
			App.angle = ((diff * spin_rate) + angle) % tau;
			App.draw()
			
			// ctx.canvas.style.transform = `rotate3d(0, 0, 1, ${ -App.angle }rad)`;
			window.requestAnimationFrame(spin);
		}
	},

	draw: () => {
		if (App.src === null) {
			return null;
		}

		let { angle } = App;
		let { ctx, src, imgData, diameter, blades } = App.consts;
		let { fade } = App.config;
		let srcData = src.getImageData(0, 0, src.canvas.width, src.canvas.height)
			
		for (var i=0; i<imgData.data.length; i++) {
			imgData.data[i] = imgData.data[i] * 0.95;
		}

		for (var i=0; i<blades.length; i++) {
			let { offset, absolute, relative } = blades[i];
			let { length } = relative;

			for (var j=0; j<length; j++) {
				let { x, y } = relative[j];
				// let p = absolute[j];

				//Rotate the positions around the center, by blade offset
				let cos = Math.cos(angle);
        let sin = Math.sin(angle);
        let rotated_x = (cos * x) + (sin * y);
				let rotated_y = (cos * y) - (sin * x);

	      let abs_x = Math.round((rotated_x + 0.5) * srcData.width);
	      let abs_y = Math.round((rotated_y + 0.5) * srcData.height);

	      let target_x = Math.round((rotated_x + 0.5) * imgData.width);
	      let target_y = Math.round((rotated_y + 0.5) * imgData.height);

	      // if (App.loaded) {
	      // 	console.log(i, x, rotated_x, abs_x, y, rotated_y, abs_y)
	      // }

	      let idx = (abs_x + (abs_y * srcData.width)) * 4;
	      let pIdx = (target_x + (target_y * diameter)) * 4;

	      imgData.data[pIdx] = srcData.data[idx];
				imgData.data[pIdx + 1] = srcData.data[idx + 1];
				imgData.data[pIdx + 2] = srcData.data[idx + 2];
				imgData.data[pIdx + 3] = srcData.data[idx + 3];
	    }
		}

		ctx.putImageData(imgData, 0, 0);
	},

	stop: () => {
		clearInterval(timer);
		App.started = false;
	},

	loadSrc: (e) => {
		App.loaded = false;

		let { files } = e.target;
		let preview = document.querySelector("#preview").getContext("2d");
		
		let img = document.querySelector("#image");
		let video = document.querySelector("#video");
		let media = null;

		if (files?.length){
      var oFReader = new FileReader();
      oFReader.readAsDataURL(files[0]);
      oFReader.onload = (oFREvent) => {
      	if (["image/jpg", "image/jpeg", "image/png", "image/gif"].includes(files[0].type)) {
        	img.src = oFREvent.target.result;
        } else {
        	video.src = oFREvent.target.result;
        }
      }
    }
	},

	setupLoad: () => {
		let preview = document.querySelector("#preview").getContext("2d");
		let src = App.consts.src;
		
		let img = document.querySelector("#image");
		let video = document.querySelector("#video");
		
		img.addEventListener("load", () => {
    	let [sw, sh, sx, sy] = App.getMediaDimensions(img);
    	preview.drawImage(img, sx, sy, sw, sh, 0, 0, 100, 100);

    	src.canvas.width = sw;
    	src.canvas.height = sh;
    	src.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    	App.loaded = true;
    });

    video.addEventListener("loadeddata", () => {
    	video.play();
    	video.loop = true;
    	
    	let [sw, sh, sx, sy] = App.getMediaDimensions(video);
    	
    	preview.drawImage(video, sx, sy, sw, sh, 0, 0, 100, 100);
    	
    	src.canvas.width = sw;
    	src.canvas.height = sh;
    	
    	App.loaded = true;

    	App.drawVideoFrame();
    });
	},

	drawVideoFrame: () => {
		let src = App.consts.src;
		let video = document.querySelector("#video");
		
		let [sw, sh, sx, sy] = App.getMediaDimensions(video);
    
    src.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

   	if (
   		video.paused !== true &&
   		video.ended !== true
   	) {
   		window.requestAnimationFrame(App.drawVideoFrame);
   	}
	},

	getMediaDimensions: (media) => {
		let sw = media.scrollWidth;
  	let sh = media.scrollHeight;
  	let sx = 0;
  	let sy = 0;
  	
  	if (sh !== sw) {
  		if (sh > sw) {
  			sy = Math.floor((sh - sw) / 2);
  			sh = sw;
  		} else {
  			sx = Math.floor((sw - sh) / 2);
  			sw = sh;
  		}
  	}

  	return [sw, sh, sx, sy];
	},

	setSpinRate: () => {
		App.consts.spin_rate = ((1000 / (60000 / App.config.rpm)) / 1000) * (Math.PI * 2)
	},

	createBlades: () => {
		let { blades } = App.config;

		for (var i=0; i<blades; i++) {
			App.consts.blades.push({
				offset: 0,
				relative: [],
				absolute: [],
				color: []
			})
		}
	},

	setBladeOffset: () => {
		let offset = (Math.PI * 2) / App.config.blades;

		for (var i=0; i<App.config.blades; i++) {
			let blade = App.consts.blades[i];
					blade.offset = i * offset;
		}
	},

	setBladePixels: () => {
		let {rows, length, oDiameter, iDiameter, bWidth} = App.config;
		let {diameter, tau, blades} = App.consts;

		const rel_offsets = [
			[0],
			[-1, 1],
			[-1, 0, 1],
			[-1, -0.33, 0.33, 1],
			[-1, -0.5, 0, 0.5, 1]
		];

		const abs_offsets = rel_offsets.map((offsets, idx) => {
			return offsets.map((p) => {
				return Math.round(p * (bWidth / 2));
			})
		})

		const rel_x = (((oDiameter - iDiameter) / oDiameter) / (length - 1)) / 2;
		const rel_start = ((iDiameter / oDiameter) / 2);

		for (var b=0; b<blades.length; b++) {
			let blade = blades[b];

			for (var i=0; i<length; i++) {
				for (var j=0; j<rows; j++) {
					// Gets the unrotated, relative positions for each pixel
					let raw_x = rel_start + (rel_x * i);
					let raw_y = (rel_offsets[rows - 1][j] * (bWidth / oDiameter));
					
					//Rotate the positions around the center, by blade offset
					let cos = Math.cos(blade.offset);
	        let sin = Math.sin(blade.offset);
	        let rotated_x = (cos * raw_x) + (sin * raw_y);
					let rotated_y = (cos * raw_y) - (sin * raw_x);

	        blade.relative.push({x: rotated_x, y: rotated_y});

	        let abs_x = Math.round((rotated_x + 0.5) * diameter);
	        let abs_y = Math.round((rotated_y + 0.5) * diameter);

	        blade.absolute.push((abs_x + (abs_y * diameter)) * 4);
				}
			}
		}
	}
}
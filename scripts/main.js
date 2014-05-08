require.config({
		baseUrl: 'scripts/',
		// ...
		packages: [
			{
				name: 'physicsjs',
				location: 'physicsjs',
				main: 'physicsjs-0.6.0.min'
			}
		],
		// ...
});

require([
		'gamepad',
		'physicsjs',
		'physicsjs/renderers/canvas',
		'physicsjs/behaviors/edge-collision-detection',
		'physicsjs/behaviors/body-impulse-response',
		'physicsjs/behaviors/constant-acceleration',
		'physicsjs/behaviors/body-collision-detection',
		'physicsjs/behaviors/verlet-constraints',
		'physicsjs/behaviors/sweep-prune',
		'physicsjs/behaviors/interactive',
		'physicsjs/bodies/circle', // circle
		'physicsjs/bodies/rectangle' // rectangle
	], function( Gamepad, Physics ) {
		// do something with the circles
		//
	Physics(function(world){
		var viewWidth = 1024;
		var viewHeight = 1024;

		var renderer = Physics.renderer('canvas', {
				el: 'viewport',
				width: viewWidth,
				height: viewHeight,
				meta: false,
				styles: {
					// set colors for the circle bodies
					'circle' : {
						strokeStyle: '#351024',
						lineWidth: 1,
						fillStyle: '#d33682',
						angleIndicator: '#351024'
					}
				}
		});

		var ropeStyles = {
			strokeStyle: '#FF0000',
			lineWidth: 1
		};

		// add renderer
		world.add(renderer);

		// render each step
		world.on('step', function(){
		    if(players[0].ropeLengthDelta != 0){
		        players[0].resizeRope(players[0].ropeLengthDelta);
            }
			world.render();
		});

		// bounds of the window
		var viewportBounds = Physics.aabb(0, 0, viewWidth, viewHeight);

		// constrain object to viewport bounds
		world.add(Physics.behavior('edge-collision-detection', {
					aabb: viewportBounds,
					restitution: 0.3,
					cof: 0.99
		}));

		// constraints behavior for ropes etc
		var constr = Physics.behavior('verlet-constraints');
		world.add(constr);

        // possible rope attachment states
		var AttachStates = Object.freeze({"free":1, "attached":2, "firing":3});

        // Player class
        function Player(pos) {
            this.body = Physics.body('circle', {
                    x: pos.x,
                    y: pos.y,
                    vx: 0.2,
                    vy: 0.01,
                    radius: 8,
                    label: 'player'
            });
            this.attach = Physics.body('circle', {
                    x: pos.x,
                    y: pos.y - 50, // todo: something smarter
                    radius: 4,
                    treatment: 'static'
            });
            this.ropeConstraint = constr.distanceConstraint(this.body, this.attach, 0, 100);
            this.attachState = AttachStates.attached;

            this.ropeLengthDelta = 0

            world.add(this.body);
            world.add(this.attach);

            this.accelerate = function(v){this.body.accelerate(v);};
            this.detachRope = function(){
                this.attachState = AttachStates.free;
                constr.remove(this.ropeConstraint);
            }
            
            this.shootAnchor = function(angle, type){
                if (this.attachState == AttachStates.firing){
                    return;
                }
                this.attachState = AttachStates.firing;
                vx = Math.sin(angle)*1.5;
                vy = Math.cos(angle)*-1.5;
                //console.log("angle:" + angle + ", " + vx + " " + vy); 
                var b = Physics.body('circle', {
                    x: this.body.state.pos.x,
                    y: this.body.state.pos.y,
                    vx: vx,
                    vy: vy,
                    radius: 3,
                    label: 'bullet',
                    bulletType: type
                });
                constr.remove(this.ropeConstraint);
                world.add(b);
                bullet.push(b);
            }

            // change this player's attachment position to somewhere else
            this.attachRope = function(pos){
                constr.remove(this.ropeConstraint); // remove this constraint if it exists
                this.attach.state.pos = pos
                var dist = this.body.state.pos.dist(this.attach.state.pos);
                this.ropeConstraint = constr.distanceConstraint(this.body, this.attach, 0, dist);
                this.attachState = AttachStates.attached;
            };

            this.resizeRope = function(diff){ // todo: make this less clunkier. probably set a flag and let the clock deal with it each iter
                if (this.attachState != AttachStates.attached){ return; }
                var len = this.ropeConstraint.targetLength + diff;
                if (len<0){ len = 0; }
                constr.remove(this.ropeConstraint);
                this.ropeConstraint = constr.distanceConstraint(this.body, this.attach, 0, len);
            };

            this.yankPlayer = function(pos){
                constr.remove(this.ropeConstraint);
                this.attachState = AttachStates.free;
            
                console.log("yanking " + pos); 
                var yankvel = 0.04;
                var angle = angleBetweenPos(this.body.state.pos, pos);
                vx = Math.sin(angle)*yankvel;
                vy = Math.cos(angle)*-1*yankvel;

                // cut current acceleration in half before applying new accel
                this.body.state.acc = this.body.state.acc.mult(0.3);
                this.accelerate(Physics.vector(vx, vy));

            }
        }

        // end Player class

		// create a player
		var players = [];
		players[0] = new Player(Physics.vector(50,60));

		// add a circle

		
		var bullet = [];

		var platform = Physics.body('rectangle', {
				x: 350,
				y: 100,
				width:400,
				height:15,
				treatment: 'static'
		});
		var platformtwo = Physics.body('rectangle', {
				x: 700,
				y: 400,
				width:300,
				height:100,
				treatment: 'static'
		});

		world.add(platform);
		world.add(platformtwo);



		// ensure objects bounce when edge collision detected
		world.add(Physics.behavior('body-impulse-response', {check: 'collisions:applyimpulse'}).applyTo([players[0].body, platform]) ); // todo: filter objects differently (don't want bullets to bounce)

		world.add(Physics.behavior('body-collision-detection'));
		world.add(Physics.behavior('sweep-prune'));

		// add some gravity
		world.add(Physics.behavior('constant-acceleration') );

		// allow interaction
		//world.add(Physics.behavior('interactive', {el: renderer.el}));

        var handlekey = function handlekey(evt){
            evt.preventDefault(); // stop things like space scrolling the page
            //console.log(evt);
            //console.log(e);
            switch(evt.keyCode)
            {
                case 119: // w (up)
                case 87:
                    //players[0].resizeRope(-10);
                    players[0].ropeLengthDelta = -2;
                    break;
                case 115: // s (down)
                case 83:
                    //players[0].resizeRope(10);
                    players[0].ropeLengthDelta = 2;
                    break;
                case 65: // a (left)
                    players[0].accelerate(Physics.vector(-0.0005));
                    break;
                case 68: // d (right)
                    players[0].accelerate(Physics.vector(0.0005));
                    break;
                case 32: // space
                    players[0].detachRope();
                    break;
            }

            //console.log(e.targetLength);
        }

        var handlekeyup = function handlekeyup(evt){
            switch(evt.keyCode)
            {
                case 87: // w up
                case 83: // s down
                    players[0].ropeLengthDelta = 0;
                    break;
            }
        };

		document.addEventListener('keydown', handlekey, false);
		document.addEventListener('keyup', handlekeyup, false);

		Gamepad.onButtonDown = function(buttonnum){
		    switch(buttonnum)
            {
                case 12: // up
                    players[0].ropeLengthDelta = -2;
                    break;
                case 13: // down
                    players[0].ropeLengthDelta = 2;
                    break;
            }
        };

		Gamepad.onButtonUp = function(buttonnum){
		    switch(buttonnum)
            {
                case 12: // up
                case 13: // down
                    players[0].ropeLengthDelta = 0;
                    break;
            }
        };


		function shootrope(pos, type){ // attach rope on click
		    var angle = angleBetweenPos(players[0].body.state.pos, pos);
			players[0].shootAnchor(angle, type);
		}

		function angleBetweenPos(body, target){
		    var relposX = target.x - body.x; // todo: don't use players[0]
		    var relposY = target.y - body.y;

		    //console.log("relpos: " + relposX + ", " + relposY);
			var vpos = Physics.vector(relposX, relposY);
			var angle = vpos.angle() + 0.5*Math.PI;
			return angle;

        }

        world.on('collisions:hook', function(data){ // todo: generalize hook collision hook to work with multiple players
            world.remove(data.bullet)
            switch(data.type)
            {
                case 'hook': // swinging hook event
                    players[0].attachRope(data.bullet.state.pos);
                    break;
                case 'yank':
                    players[0].yankPlayer(data.bullet.state.pos);
                    break;
            }
        });
        world.on('collisions:detected', function(data){
            //console.log(data);
            var c;
            for (var i=0, l=data.collisions.length; i<l; i++){
                c = data.collisions[i];
                if (c.bodyA.label == 'bullet' || c.bodyB.label == 'bullet'){
                    var bul;
                    var obj;
                    if (c.bodyA.label == 'bullet'){
                        bul = c.bodyA;
                        obj = c.bodyB;
                    } else {
                        bul = c.bodyB;
                        obj = c.bodyA;
                    }
                    if (obj.label != 'player'){

                        console.log("bullet collision with a " + obj.label);
                        var data = {'bullet': bul, 'object': obj, 'type': bul.bulletType}
                        world.emit('collisions:hook', data)
                    }
                    else
                    {
                        console.log("collided with player")
                    }

                }
                else {
                    var d = {'collisions': [c]};
                    world.emit('collisions:applyimpulse', d);
                }
            }
        });

        var handleclick = function handleclick(e){
            console.log(e);
            var pos = getCoords(e);
            switch(e.button){
                case 0: // lmb
                    shootrope(pos, 'hook');
                    break;
                case 2: // rmb
                    shootrope(pos, 'yank');
                    console.log("rmb");
                    break;
            }

        }
        renderer.el.addEventListener('mousedown', handleclick);
        //block context menu
        renderer.el.addEventListener('contextmenu', function(e){e.preventDefault();return false;});
        // helper functions for cursor pos
        var getElementOffset = function( el ){
                var curleft = 0
                    ,curtop = 0
                    ;
    
                if (el.offsetParent) {
                    do {
                        curleft += el.offsetLeft;
                        curtop += el.offsetTop;
                    } while (el = el.offsetParent);
                }
    
                return { left: curleft, top: curtop };
            }

        var getCoords = function( e ){
                var offset = getElementOffset( e.target )
                    ,obj = ( e.changedTouches && e.changedTouches[0] ) || e
                    ,x = obj.pageX - offset.left
                    ,y = obj.pageY - offset.top
                    ;
    
                return {
                    x: x
                    ,y: y
                };
        };
		// lines for rope
		world.on('render-rope', function (ctx){
			/* the below is basically copied from the tree demo. not useful right now, keeping for later
			var constrs = ball.constraints.getConstraints().distanceConstraints,c;
			for (var i = 0, l = constrs.length; i<l; ++i){
				c = constrs[i];
				renderer.drawLine(c.bodyA.state.pos, c.bodyB.state.pos, ropeStyles, ctx);
			}
			*/
			// todo: loop across players.
			if(players[0].attachState == AttachStates.attached){
                renderer.drawLine(players[0].body.state.pos, players[0].attach.state.pos, ropeStyles, ctx);
            }
		});

		renderer.addLayer('ropes', null, { zIndex:0 }).render = function(){
			this.ctx.clearRect(0, 0, this.el.width, this.el.height);
			world.emit('render-rope', this.ctx);
		};

		// subscribe to ticker to advance the simulation
		Physics.util.ticker.on(function(time,dt){
		    // update gamepad
            Gamepad.tick();
		    // update simulation
			world.step(time);
		});

		// start the ticker
		Physics.util.ticker.start();

	});
});

dojo.provide("dijit.base.Toaster");

dojo.require("dojo.event.common");
dojo.require("dojo.event.topic");
dojo.require("dojo.lfx.html");
dojo.require("dojo.html.iframe");

dojo.require("dijit.base.Widget");
dojo.require("dijit.base.TemplatedWidget");

// This is mostly taken from Jesse Kuhnert's MessageNotifier.
// Modified by Bryan Forbes to support topics and a variable delay.
// Modified by Karl Tiedt to support 0 duration messages that require user interaction and message stacking

dojo.declare(
	"dijit.base.Toaster",
	[dijit.base.Widget, dijit.base.TemplatedWidget],
	null,
	{
		// summary
		//		Message that slides in from the corner of the screen, used for notifications
		//		like "new email".
		templateString: '<div dojoAttachPoint="clipNode"><div dojoAttachPoint="containerNode" dojoAttachEvent="onClick:onSelect"><div dojoAttachPoint="contentNode"></div></div></div>',

		// messageTopic: String
		//		Name of topic; anything published to this topic will be displayed as a message.
		//		Message format is either String or an object like
		//		{message: "hello word", type: "error", duration: 500}
		messageTopic: "",
		
		// messageTypes: Enumeration
		//		Possible message types.
		messageTypes: {
			MESSAGE: "message",
			WARNING: "warning",
			ERROR: "error",
			FATAL: "fatal"
		},
		
		// defaultType: String
		//		If message type isn't specified (see "messageTopic" parameter),
		//		then display message as this type.
		//		Possible values in messageTypes enumeration ("message", "warning", "error", "fatal")
		defaultType: "message",

		// css classes
		clipCssClass: "dojoToasterClip",
		containerCssClass: "dojoToasterContainer",
		contentCssClass: "dojoToasterContent",
		messageCssClass: "dojoToasterMessage",
		warningCssClass: "dojoToasterWarning",
		errorCssClass: "dojoToasterError",
		fatalCssClass: "dojoToasterFatal",

		// positionDirection: String
		//		Position from which message slides into screen, one of
		//		["br-up", "br-left", "bl-up", "bl-right", "tr-down", "tr-left", "tl-down", "tl-right"]
		positionDirection: "br-up",
		
		// positionDirectionTypes: Enumeration
		//		Possible values for positionDirection parameter
		positionDirectionTypes: ["br-up", "br-left", "bl-up", "bl-right", "tr-down", "tr-left", "tl-down", "tl-right"],

		// duration: Integer
		//		Number of milliseconds to show message
		duration: "2000",

		//separator: String
		//		String used to separate messages if consecutive calls are made to setContent before previous messages go away
		separator: "<hr></hr>",

		postCreate: function(){
			dijit.base.Toaster.superclass.postCreate.apply(this);
			this.hide();
			dojo.html.setClass(this.clipNode, this.clipCssClass);
			dojo.html.addClass(this.containerNode, this.containerCssClass);
			dojo.html.setClass(this.contentNode, this.contentCssClass);
			if(this.messageTopic){
				dojo.event.topic.subscribe(this.messageTopic, this, "_handleMessage");
			}
			if(!this.positionDirection || !dojo.lang.inArray(this.positionDirectionTypes, this.positionDirection)){
				this.positionDirection = this.positionDirectionTypes[0];
			}
		},

		_handleMessage: function(/*String|Object*/message){
			if(dojo.lang.isString(message)){
				this.setContent(message);
			}else{
				this.setContent(message.message, message.type, message.duration);
			}
		},

		setContent: function(/*String|Node*/message, /*String*/messageType, /*int?*/duration){
			// summary
			//		sets and displays the given message and show duration
			// message:
			//		the message
			// messageType:
			//		type of message; possible values in messageTypes enumeration ("message", "warning", "error", "fatal")
			// duration:
			//		duration in milliseconds to display message before removing it. Widget has default value.
			duration = duration||this.duration;
			// sync animations so there are no ghosted fades and such
			if(this.slideAnim){
				if(this.slideAnim.status() != "playing"){
					this.slideAnim.stop();
				}
				if(this.slideAnim.status() == "playing" || (this.fadeAnim && this.fadeAnim.status() == "playing")){
					dojo.lang.setTimeout(50, dojo.lang.hitch(this, function(){
						this.setContent(message, messageType);
					}));
					return;
				}
			}

			if(!this.positionDirection || !dojo.lang.inArray(this.positionDirectionTypes, this.positionDirection)){
				dojo.raise(this.widgetId + ".positionDirection is an invalid value: " + this.positionDirection);
			}

			// determine type of content and apply appropriately
			for(var type in this.messageTypes){
				dojo.html.removeClass(this.containerNode, this[this.messageTypes[type]+"CssClass"]);
			}
			dojo.html.clearOpacity(this.containerNode);

			var newMessage;
			if(message instanceof String || typeof message == "string"){
				newMessage = message;
			}else if(dojo.html.isNode(message)){
				newMessage = dojo.html.getContentAsString(message);
			}else{
				dojo.raise("Toaster.setContent(): message is of unknown type:" + message);
			}

			if(newMessage && this.isVisible){
				newMessage = this.contentNode.innerHTML + "<br>" + this.separator + "<br>" + newMessage;
			}
			this.contentNode.innerHTML = newMessage;

			dojo.html.addClass(this.containerNode, this[messageType+"CssClass"] || this[this.defaultType+"CssClass"]);

			// now do funky animation of widget appearing from
			// bottom right of page and up
			this.show();
			var nodeSize = dojo.html.getMarginBox(this.containerNode);
			
			if(this.isVisible){
				this._placeClip();
			}else{
				var style = this.containerNode.style;
				var pd = this.positionDirection;
				// sets up initial position of container node and slide-out direction
				if(pd.indexOf("-up") >= 0){
					style.left=0+"px";
					style.top=nodeSize.height + 10 + "px";
				}else if(pd.indexOf("-left") >= 0){
					style.left=nodeSize.width + 10 +"px";
					style.top=0+"px";
				}else if(pd.indexOf("-right") >= 0){
					style.left = 0 - nodeSize.width - 10 + "px";
					style.top = 0+"px";
				}else if(pd.indexOf("-down") >= 0){
					style.left = 0+"px";
					style.top = 0 - nodeSize.height - 10 + "px";
				}else{
					dojo.raise(this.widgetId + ".positionDirection is an invalid value: " + pd);
				}

				this.slideAnim = dojo.lfx.html.slideTo(
					this.containerNode,
					{ top: 0, left: 0 },
					450,
					null,
					dojo.lang.hitch(this, function(nodes, anim){
						//we build the fadeAnim here so we dont have to duplicate it later
						// can't do a fadeHide because we're fading the
						// inner node rather than the clipping node
						this.fadeAnim = dojo.lfx.html.fadeOut(
							this.containerNode,
							1000,
							null,
							dojo.lang.hitch(this, function(evt){
								this.isVisible = false;
								this.hide();
							}));
						//if duration == 0 we keep the message displayed until clicked
						//TODO: fix so that if a duration > 0 is displayed when a duration==0 is appended to it, the fadeOut is canceled
						if(duration>0){
							dojo.lang.setTimeout(dojo.lang.hitch(this, function(evt){
								// we must hide the iframe in order to fade
								// TODO: figure out how to fade with a BackgroundIframe
								if(this.bgIframe){
									this.bgIframe.hide();
								}
								this.fadeAnim.play();
							}), duration);
						}else{
							dojo.event.connect(
								this,
								'onSelect',
								dojo.lang.hitch(this, function(evt){
									this.fadeAnim.play();
								}));
						}
						this.isVisible = true;
					})).play();
				}
		},

		_placeClip: function(){
			var scroll = dojo.html.getScroll();
			var view = dojo.html.getViewport();

			var nodeSize = dojo.html.getMarginBox(this.containerNode);

			var style = this.clipNode.style;
			// sets up the size of the clipping node
			style.height = nodeSize.height+"px";
			style.width = nodeSize.width+"px";

			// sets up the position of the clipping node
			var pd = this.positionDirection;
			if(pd.match(/^t/)){
				style.top = scroll.top+"px";
			}else if(pd.match(/^b/)){
				style.top = (view.height - nodeSize.height - 2 + scroll.top)+"px";
			}
			if(pd.match(/^[tb]r-/)){
				style.left = (view.width - nodeSize.width - 1 - scroll.left)+"px";
			}else if(pd.match(/^[tb]l-/)){
				style.left = 0 + "px";
			}

			style.clip = "rect(0px, " + nodeSize.width + "px, " + nodeSize.height + "px, 0px)";
			if(dojo.render.html.ie){
				if(!this.bgIframe){
					this.bgIframe = new dojo.html.BackgroundIframe(this.clipNode);
					this.bgIframe.setZIndex(this.clipNode);
				}
				this.bgIframe.onResized();
				this.bgIframe.show();
			}
		},

		onSelect: function(/*Event*/e){
			// summary: callback for when user clicks the message
		},

		show: function(){
			// summary: show the Toaster
			dojo.html.show(this.containerNode);

			this._placeClip();

			if(!this._scrollConnected){
				this._scrollConnected = true;
				dojo.event.connect(window, "onscroll", this, "_placeClip");
			}
		},

		hide: function(){
			// summary: hide the Toaster

			//Q: ALP: I didn't port all the toggler stuff from d.w.HtmlWidget.  Is it needed? Ditto for show.
			dojo.html.hide(this.containerNode);

			if(this._scrollConnected){
				this._scrollConnected = false;
				dojo.event.disconnect(window, "onscroll", this, "_placeClip");
			}

			dojo.html.setOpacity(this.containerNode, 1.0);
		}
	}
);

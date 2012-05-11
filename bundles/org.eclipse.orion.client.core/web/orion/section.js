/*******************************************************************************
 * @license
 * Copyright (c) 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
define(['dojo', 'orion/selection', 'orion/commands'], function(dojo, mSelection, mCommands){
	

	/**
	 * Generates a section
	 * 
	 * @param parent parent node
	 * @param options.id [required] id of the section header
	 * @param options.explorer [required] explorer that is the parent of this section
	 * @param options.title [required] title of the section
	 * @param options.serviceRegistry [optional] required if selection service is to be used
	 * @param options.commandService [optional] required if there are any commands in this section
	 * @param options.iconClass [optional] the class of the icon decorating section, no icon displayed if not provided
	 * @param options.content [optional] content of the section in HTML. May be set later using setContent()
	 * @param options.slideout {boolean} [optional] if true section will contain generated slideout
	 * @param options.canHide {boolean} [optional] if true section may be hidden
	 * @param options.hidden {boolean} [optional] if true section will be hidden at first display
	 * @returns Section object
	 */
	function Section(parent, options) {
		
		var that = this;
		
		if (!options.id) {
			throw new Error("Missing required argument: id");
		}
		this.id = options.id;
		
		if (!options.explorer) {
			throw new Error("Missing required argument: explorer");
		}
		this._explorer = options.explorer;
		
		if (!options.title) {
			throw new Error("Missing required argument: title");
		}

		// setting up the section
		
		this.domNode = dojo.create( "div", {"class":"auxpaneHeading sectionWrapper toolComposite", "id": options.id}, parent );
		
		if(options.iconClass){
			var icon = dojo.create( "span", { "class":"sectionIcon" }, this.domNode );
			dojo.addClass(icon, options.iconClass);
		}
		
		this.titleNode = dojo.create( "div", { id: options.id + "Title", "class":"sectionAnchor layoutLeft", innerHTML: options.title }, this.domNode );
		this._progressNode = dojo.create( "div", { id: options.id + "Progress", "class": "sectionProgress layoutLeft", innerHTML: "..."}, this.domNode );
		this._toolActionsNode = dojo.create( "div", { id: options.id + "ToolActionsArea", "class":"layoutRight sectionActions"}, this.domNode );
		this.actionsNode = dojo.create( "div", { id: options.id + "ActionArea", "class":"layoutRight sectionActions"}, this.domNode );
		this.selectionNode = dojo.create( "div", { id: options.id + "SelectionArea", "class":"layoutRight sectionActions"}, this.domNode );
		
		if(options.slideout){
			this.slideout = '<div id="' + options.id + 'slideContainer" class="layoutBlock slideParameters slideContainer">' +
								'<span id="' + options.id + 'slideOut" class="slide">' +
								   '<span id="' + options.id + 'pageCommandParameters" class="parameters"></span>' +
								   '<span id="' + options.id + 'pageCommandDismiss" class="parametersDismiss"></span>' +
								'</span>' +
							'</div>';
			dojo.place(this.slideout, this.domNode);
		}

		this._contentParent = dojo.create("div", { "id": this.id + "Content", "role": "region", "class":"sectionTable", "aria-labelledby": this.titleNode.id}, parent, "last");
		this._content = dojo.create("div", {"class": "plugin-settings"}, this._contentParent);
		
		if(options.content){
			this.setContent(options.content);
		}
		
		if (options.hidden){
			dojo.style(this._contentParent, "display", "none");
			this.hidden = true;
		}
		
		this._serviceRegistry = options.serviceRegistry;
		this._commandService = options.commandService;
		
		this._lastMonitor = 0;
		this._loading = {};
		
		if(options.canHide && options.commandService) {		
			var hideSectionCommand = new mCommands.Command({
				id : "eclipse.orion.page.hideSectionCommand_" + this.id,
				callback : function(data) {
					var t = new dojo.fx.Toggler({
						node: that._contentParent.id,
						showDuration: 500,
						hideDuration: 500,
						showFunc: dojo.fx.wipeIn,
						hideFunc: dojo.fx.wipeOut
						});
						
						if (!that.hidden){
							t.hide();
							that.hidden = true;
						} else {
							t.show();
							that.hidden = false;
						}
						
						dojo.empty(that._toolActionsNode.id);
						that._commandService.renderCommands(that._toolActionsNode.id, that._toolActionsNode.id, {}, that._explorer, "button");
				},
				visibleWhen : function(item) {
					this.name = that.hidden ? "View" : "Hide";
					this.tooltip = that.hidden ? "View" : "Hide";
					return true;
				}
			});
			
			this._commandService.addCommand(hideSectionCommand);
			
			this._commandService.registerCommandContribution(this._toolActionsNode.id, hideSectionCommand.id, 100);
			this._commandService.renderCommands(this._toolActionsNode.id, this._toolActionsNode.id, {}, this._explorer, "button");
		}
	};
	
	Section.prototype = {
			
		/**
		 * Changes the title of section
		 * @param title
		 */
		setTitle: function(title){
			this.titleNode.innerHTML = title;
		},
		
		/**
		 * Changes the contents of the section.
		 * @param content
		 */
		setContent: function(content){
			this._content.innerHTML = content;
		},
		
		/**
		 * Register command to this section
		 * @param commandId
		 * @param position
		 * @param parentPath
		 * @param bindingOnly
		 * @param keyBinding
		 * @param urlBinding
		 */
		registerCommandContribution: function(commandId, position, parentPath, bindingOnly, keyBinding, urlBinding){
			this._commandService.registerCommandContribution(this.actionsNode.id, commandId, position, parentPath, bindingOnly, keyBinding, urlBinding);
		},
		
		/**
		 * Render commands for this section
		 * @param items
		 * @param renderType
		 * @param userData
		 */
		renderCommands: function(items, renderType, userData){
			this._commandService.renderCommands(this.actionsNode.id, this.actionsNode, items, this._explorer, renderType, userData);
		},
		
		createProgressMonitor: function(){
			return new ProgressMonitor(this);
		},
		
		_setMonitorMessage: function(monitorId, message){
			this._progressNode.style.visibility = "visible";
			this._loading[monitorId] = message;
			var progressTitle = "";
			for(var loadingId in this._loading){
				if(progressTitle!==""){
					progressTitle+="\n";
				}
				progressTitle+=this._loading[loadingId];
			}
			this._progressNode.title = progressTitle;
		},
		
		_monitorDone: function(monitorId){
			delete this._loading[monitorId];
			var progressTitle = "";
			for(var loadingId in this._loading){
				if(progressTitle!==""){
					progressTitle+="\n";
				}
				progressTitle+=this._loading[loadingId];
			}
			this._progressNode.title = progressTitle;
			if(progressTitle===""){
				this._progressNode.style.visibility = "hidden";
			}
		}
	};
	
	Section.prototype.constructor = Section;
	
	// ProgressMonitor
	
	function ProgressMonitor(section){
		this._section = section;
		this._id = ++section._lastMonitor;
	}
	
	ProgressMonitor.prototype = {
		begin: function(message){
			this.status = message;
			this._section._setMonitorMessage(this.id, message);
		},
		
		worked: function(message){
			this.status = message;
			this._section._setMonitorMessage(this.id, message);
		},
		
		done: function(status){
			this.status = status;
			this._section._monitorDone(this.id);
		}
	};
	
	ProgressMonitor.prototype.constructor = ProgressMonitor;

	return {Section: Section};
});
// Editor for graph structures (based on d3)
//
// Developed by Brian Ben Maranville 
// at the National Institute of Standards and Technology,
// Gaithersburg, Maryland, USA
// This software is in the public domain and is not copyrighted
//
// can be initialized with data such as:
//
// data = [{
//   modules: [
//     {
//       title: "Load\ndata",
//       inputs: ["in_a"],
//       outputs: ["out_0", "out_b"],
//       x: 200
//     },
//     { 
//       title: "background",
//       x: 300
//     }
//   ],
//   wires: [{source: [0, "out_b"], target: [1, "in_0"]}],
// }];
// 

/* requires('d3.js'); */
'use strict';

import * as d3 from 'd3';
import {event as currentEvent} from 'd3';
import {extend} from './jquery-extend';

export {editor};
export default editor;

//if does not have an ID 
if (!d3.hasOwnProperty("id")) 
  d3.id = (function(){var a = 0; return function(){return a++}})();

//edits the modules and wires
function editor(data, autosize_modules) {
	
  var data = data || [];
  var module_defs = module_defs || {};
  var grid_spacing = 5;
  var wirecurve = 0.67;
  var svg, container;
  var dispatch = d3.dispatch("update", "draw_wires");
  
  dispatch.on("update", update);
  dispatch.on("draw_wires", draw_wires);
  
  //returns the wire's source and target
  var wire_keyfn = function(d) {
	  return "{source: " + d.source + "," + "target: " + d.target + "}"
  };
  
  //returns whether there there is a module index and a terminal ID
  var check_end = function(e) {
	 
	//if on cursor
    if (e == 'cursor') 
		return true;
	
	//if has two sides
    else{
		
        //var es = e.split(":"); // not making string pair around : anymore
        if (e.length != 2)
			return false; 
		
        var module_index = e[0];
        var terminal_id = e[1];
			
        return (container.select('.module[index="' + module_index + '"] .terminal[terminal_id="' + terminal_id + '"]').empty() == false);
    }
  }
  
  /*
  var wire_checkends = function(w) {
    var src_exists, tgt_exists;
    src_exists = (w.source == 'cursor' || !(svg.select('[id=\"' + w.source + '\"]').empty()) );
    tgt_exists = (w.target == 'cursor' || !(svg.select('[id=\"' + w.target + '\"]').empty()) );
    return (src_exists && tgt_exists)
  }
  */
  
  //returns if the wire has a source and a target
  var wire_checkends = function(w) {
    return (check_end(w.source) && check_end(w.target))
  }
  
  //rewires using the new indexes
  function rewire(index_updates) {
	  
    var wires = svg.datum().wires;
    var end_names = ['source', 'target'];
	
	//check the wire
    wires.forEach(function(w) {
		
      end_names.forEach(function(e) {
		  
        var end = w[e];
		
		//if end not at the cursor and if there are two sides
        if (end != 'cursor' && end.length == 2) {
			
          var index_in = end[0];
          var terminal_id = end[1];
		  
		  //if the current index is in the updated indexes
          if (index_in in index_updates) {
			  
            //console.log('rewiring ' + end + ' ' + index_in + ' to ' + index_updates[index_in]);
            w[e] = [index_updates[index_in], terminal_id];
          }
        }
      });
    });
  }

  //updates the modules and their wires
  function update() {

    var id_to_index = {},
        old_ids = {},
        new_ids = {},
        index_to_id = {},
        index_updates = {},
        additions = [],
        removals = [];
        
    //need to add module_ids to any modules that are missing them
    var key_fn = function(d) {
		
	  //if module does not have an ID	
      if (d.module_id == undefined) {
		
        var id = d3.id();
        Object.defineProperty(d, "module_id", {get: function() {return id}});
      }
	  
      return d.module_id; 
    }
	
    //make a map of id -> module index (in data) before doing update
    svg.selectAll(".module").each(function(d,i) { 
		old_ids[d.module_id] = i 
	});
	
    var module_update = svg.selectAll(".module").data(function(d) {return d.modules}, key_fn);
    var en = module_update.enter();
	
    en.append(module); // .each(function(d) {additions.push(d.module_id)});
    module_update.exit()/*.each(function(d) {removals.push(d.module_id)})*/.remove();
    module_update.attr("index", function(d,i) {return i});
    svg.selectAll(".module").each(function(d,i) {new_ids[d.module_id] = i });
	
	//if ii is in the old IDs
    for (var ii in old_ids) {
		
      var old_index = old_ids[ii],
          new_index = new_ids[ii];
		  
	  //if the indexes equal each other
      if (old_index != new_index) 
        index_updates[old_index] = new_index;
    }
    
    //moves endpoints when index shifts because of deletions below in the list of modules
    rewire(index_updates);
    
    //remove wires without existing endpoints
    svg.datum().wires = svg.datum().wires.filter(wire_checkends);

    var wire_update = svg.selectAll(".wire").data(function(d) {return d.wires}, wire_keyfn);
    wire_update.enter().append(wire);
    wire_update.exit().remove();
    
    draw_wires();
  }
  
  //draws the wires
  function draw_wires() {
    svg.selectAll(".wire").each(draw_wire); 
  }
  
  //returns the terminal position
  function get_terminal_pos(term_id) {

    var module = container.select('.module[index="' + term_id[0] + '"]');
    var terminal = module.select('.terminal[terminal_id="' + term_id[1] + '"]');
	
	//if the terminal is empty, null
    if (terminal.empty()) 
		return null; 
	
    var reference_point = svg.node().createSVGPoint();
    var terminal_origin = reference_point.matrixTransform(terminal.node().getCTM());
	
	//represents the terminal's coordinates
    var terminal_pos = {
      x: terminal_origin.x + +terminal.attr("wireoffset_x"),
      y: terminal_origin.y + +terminal.attr("wireoffset_y")
    }
	
    return terminal_pos;
  }
  
  //draws the wire
  function draw_wire() {
	  
    var connector = d3.select(this);
    var src_pos, tgt_pos, cursor_pos;
    var src = connector.datum().source,
        tgt = connector.datum().target;
	
	//if the source and target are on the cursor
    if (src == "cursor" || tgt == "cursor") {
		
      var mouse = d3.mouse(svg.node());
      cursor_pos = {x: mouse[0] - 3, y: mouse[1] - 3}
      src_pos = tgt_pos = cursor_pos;
    }
	
	//if source is not on the cursor
    if (src != "cursor") 
      src_pos = get_terminal_pos(src);
	
	//if the target is not on the cursor
    if (tgt != "cursor") 
      tgt_pos = get_terminal_pos(tgt);
	
	//if the target or source don't have positions
    if (tgt_pos == null || src_pos == null) {
		
      var wires = svg.datum().wires;
	  
		//remove wires pointing to missing terminals
        for (var i=0; i < wires.length; i++) {
			
          var w = wires[i]; 
		  
		  //if found the wire to remove
          if (w.source == src && w.target == tgt) {
			  
			wires.pop(i);
		    break;
          }
        };
		
        dispatch.update();
    }
	
	//if the target and source have positions
    else 
      connector.attr("d", makeConnector(src_pos, tgt_pos));
  }
  
  //makes the connector
  function makeConnector(pt1, pt2) {
	  
    var d = "M";
    var dx = Math.abs(+(pt1.x) - +(pt2.x)),
        dy = Math.abs(+(pt1.y) - +(pt2.y));
		
    d  = "M" + pt1.x + "," + pt1.y + " ";
    d += "C" + (+(pt1.x) + wirecurve*dx).toFixed() + "," + pt1.y + " ";
    d += (+(pt2.x) - wirecurve*dx).toFixed() + "," + pt2.y + " ";
    d += pt2.x + "," + pt2.y;
	
    return d;
  }
  
  //sets up the modules and wires
  function editor(selection) {
	  
    container = selection; // store for later use
    svg = selection.selectAll("svg.editor").data(data)
      .enter().append("svg")
      .classed("editor", true)
      
    //unique id will be assigned to module when created
    svg.selectAll(".module")
      .data(function(d) { return d.modules }) 
      .enter().append(module)
      .attr("index", function(d,i) {return i});
      
    svg.selectAll(".wire")
      .data(function(d) {return d.wires})
      .enter().append(wire)
   
    dispatch.update();
  }
  
  // wirecurve is usually between 0 and 1
  // if 0, gives a straight-line wire connector
  // if 1, a cubic curve vertical in the middle
  editor.wirecurve = function() {
	 
	//if has no arguments
    if (!arguments.length) 
		return wirecurve; 
	
    wirecurve = _;
    return editor;
  }
  
  //updates the data
  editor.data = function(_) {
	  
	//if has no arguments  
    if (!arguments.length) 
		return svg.data() 
	
    data = _;
    return editor;
  }
  
  //exports the modules
  editor.export = function() {
	 
    //strip the internally-used module_id on the way out
    var export_data = extend(true, {}, svg.datum());     
	
	//if has modules
    if (export_data.modules) {
		
		export_data.modules.forEach(function(m) {
        delete m.module_id;
      });
    }
	
    return export_data;
  }
  
  //imports the modules
  editor.import = function(datum) {
	  
    // strip module_id on the way in - needed internally
    var import_data = extend(true, {}, datum);
	
	//if has modules
    if (import_data.modules) {
		
		import_data.modules.forEach(function(m) {
			delete m.module_id;
		});
    }
	
    //first the modules
    svg.datum({modules: [], wires: []});
    svg.datum().modules = import_data.modules;
    editor.update();
	
    //then the wires
    svg.datum().wires = import_data.wires;
    editor.update();
  }
  
  //returns the svg (scalable vector graphics)
  editor.svg = function() {
    return svg;
  }
  
  //edits the module definitions
  editor.module_defs = function(_) {
	  
	//if has no arguments
    if (!arguments.length) 
		return module_defs;
	
    module_defs = _;
    return editor;
  }
  
  editor.update = update;
  editor.draw_wires = draw_wires;
  
  var wireaction = d3.behavior.drag()
      .on("dragstart.wire", wirestart)
      .on("drag.wire", wirepull)
      .on("dragend.wire", wirestop)
  
  var active_wire = false,
      new_wiredata = null;
      
  //starts up the wire 		
  function wirestart() {
	  
    var module_el = this.parentNode.parentNode;
	
	//if the module is not wireable
    if (!d3.select(module_el).classed("wireable")) 
		return
	
    currentEvent.sourceEvent.stopPropagation();
    d3.select(this).classed("highlight", true);
	
    var terminal_id = d3.select(this).attr("terminal_id");
    var module_index = d3.select(module_el).attr("index");
    var address = [parseInt(module_index),  terminal_id];
	
    new_wiredata = {source: null, target: null}
	
    var dest_selector = (this.classList.contains("input")) ? ".wireable .output" : ".wireable .input";
    svg.selectAll(dest_selector)
      .on("mouseenter", function() {d3.select(this).classed("highlight", true)})
      .on("mouseleave", function() {d3.select(this).classed("highlight", false)})
	  
	//if has input  
    if (this.classList.contains("input")) {
		
      new_wiredata.target = address;
      new_wiredata.source = "cursor";        
    }
	
	//if doesn't have input
	else {
		
      new_wiredata.source = address;
      new_wiredata.target = "cursor";
    }
	
    active_wire = true;
    svg.datum().wires.push(new_wiredata);
    update();
  }
    
  //stops the wire
  function wirestop() {
		
    d3.select(this).classed("highlight", false);
    var active_data = new_wiredata; // d3.select(active_wire).datum();
	 
	//if has input 
    if (this.classList.contains("input")) {
		  
      var new_src = d3.select(".output.highlight");
		
	  //if the source is empty	
	  if (!new_src.empty()) {
			
        var module_index = d3.select(new_src.node().parentNode.parentNode).attr("index");
        active_data.source = [parseInt(module_index), new_src.attr("terminal_id")];
      }
    } 
	  
	//if has output  
    else if (this.classList.contains("output")) {
		  
      var new_tgt = d3.select(".input.highlight");
		
	  //if the new target is empty		
      if (!new_tgt.empty()) {
			
        var module_index = d3.select(new_tgt.node().parentNode.parentNode).attr("index");
        active_data.target = [parseInt(module_index), new_tgt.attr("terminal_id")];
      }
    }
	  
	//if the target or source is on the cursor  
    if (active_data.target == 'cursor' || active_data.source == 'cursor') 
        active_wire = false;
    
	//returns whether the target and source are active
    var matches = svg.datum().wires.filter(function(d) {
        return (d.target == active_data.target && d.source == active_data.source)
    });
	  
    //active wire should be the last added: check for existing
    //if not successful target or source match, or if duplicate: pop
    if (!active_wire || matches.length > 1) 
		svg.datum().wires.pop() 
		
    update();
    svg.selectAll(".terminal")
      .classed("highlight", false)
      .on("mouseenter", null)
      .on("mouseleave", null)
		
    active_wire = false;
  }
    
  //stops event and draws the wires	
  function wirepull() {
		
    currentEvent.sourceEvent.stopPropagation();
    draw_wires();
  }
  
  //edits the module
  function module(module_data) {
	
	var group; // this will be the module group
    if (!('x' in module_data)) module_data.x = 100; //if does not have a x-coordinate
    if (!('y' in module_data)) module_data.y = 100; //if does not have a y-coordinate 
	module_data.innerModules = [];
	module_data.joinedInput = [];
	module_data.joinedOutput = [];
	
    //look up terminals from module definition if not in module_data:
    //var terminals = module_data.terminals || dataflow.module_defs[module_data.module].terminals;
    var module_name = module_data.module;

    // lookup first from module_data, then editor instance
    var module_def = module_data.module_def || module_defs[module_name] || {};
    var input_terminals = module_data.inputs || module_def.inputs || [],
        output_terminals = module_data.outputs || module_def.outputs || [];
	
    var padding = 5;
    var min_width = 75;
    var active_wire, new_wiredata;
    
    var drag = d3.behavior.drag()
      .on("drag", dragmove)
      .origin(function(a) { return {x: module_data.x, y: module_data.y} });
      
	//drags and moves the module  
    function dragmove() {
		
	  //if not draggable	
      if (!d3.select(this).classed("draggable")) 
		  return;
	  
      module_data.x = Math.round(currentEvent.x/grid_spacing) * grid_spacing;
      module_data.y = Math.round(currentEvent.y/grid_spacing) * grid_spacing;
      group.attr("transform", "translate(" + module_data.x.toFixed() + "," + module_data.y.toFixed() + ")");
      draw_wires();
    }

	//---------------------------------------------------------------------
	
	var title;
	var titletext;
	var inputs;
	var outputs;
	var moduleType = "single"
	var inputEdge = true; 
	var outputEdge = true;
	var curX = 0;
	var curY = 0;
	
	//create and append module HTML element
    group = d3.select(this).append("g")
      .datum(module_data)
      .classed("module draggable wireable", true)
      .style("cursor", "move")
      .attr("transform", "translate(" + module_data.x.toFixed() + "," + module_data.y.toFixed() + ")")
      .attr("x-origin", module_data.x.toFixed())
      .attr("y-origin", module_data.y.toFixed())
	  
    title = group.append("g")
      .classed("title", true)
	
	inputs = group.selectAll(".inputs")
      .data(input_terminals)  
      .enter().append("g")
      .classed("terminals", true)
      .classed("inputs", true)
      
    outputs = group.selectAll(".outputs")
      .data(output_terminals) 
      .enter().append("g")
      .classed("terminals", true)
      .classed("outputs", true)
	  
	//if a single module
	if(module_name !== "ncnr.refl.combined_module")
		singleModule(moduleType, module_data, group, input_terminals, output_terminals, padding, title, inputs, outputs, titletext, curX, curY, module_defs, inputEdge, outputEdge)
		
	//if a combined module
	else{
		
		moduleType = "combined";
		combinedModule(moduleType, group, padding, title, inputs, outputs, titletext, curX, curY, module_defs, inputEdge, outputEdge);
	}
	
    group.call(drag);
    return group.node(); 
  }
  
   //represents a standard module; returns the module's width
  function singleModule(moduleType, module_data, group, input_terminals, output_terminals, padding, title, inputs, outputs, titletext, curX, curY, module_defs, inputEdge, outputEdge){
	
	var width = 75 + (padding * 2);
    var height = 20 + (padding * 2);
	
    //add title text first so other elements are drawn over it
    titletext = title.append("text")
      .classed("title text", true)
      .text(module_data.title || module_data.module)   
      .attr("x", padding + curX)
      .attr("y", padding + curY)
      .attr("dy", "1em")
	  
	//if has auto-sized modules
    if (autosize_modules){
	
      var text_width = titletext.node().getComputedTextLength() + (padding * 2);
      width = Math.max(text_width, width);
    }
	
    //add input elements to group
    inputs
		.attr("transform", function(d,i) { return "translate(-20," + (height * i).toFixed() + ")"}) 
        .append("text")
        .classed("input label", true)
        .attr("x", curX)
        .attr("y", curY) 
        .attr("dy", "1em") 
        .style("padding", padding)
        .text(function(d) { return d.label; });
	
	//if a single module
	if(moduleType === "single"){
		
		inputs.append("rect")
			.classed("terminal input", true)
			.attr("width", 20) 
			.attr("height", height)
			.attr("x", curX) 
			.attr("y", curY) 
			.attr("wireoffset_x", 0) 
			.attr("wireoffset_y", height/2)
			.attr("terminal_id", function(d) {return d.id})
			.call(wireaction)
			.append("svg:title")
			.text(function(d) { return d.id; });
	}
	
	//if a part of a combined module
	else{
		
		//add the input terminals
		for(var i = 0; i < input_terminals.length; i++){
			
			 //if has an edge input terminal 		 	
			if(inputEdge){
				
				inputs.append("rect")
					.classed("terminal input", true)
					.attr("width", 20) 
					.attr("height", height)
					.attr("x", curX) 
					.attr("y", curY + (i * 30)) 
					.attr("wireoffset_x", 0) 
					.attr("wireoffset_y", height/2)
					.attr("terminal_id", function(d) {return d.id})
					.call(wireaction)
					.append("svg:title")
					.text(function(d) { return d.id; });
			}
			
			//if not an edge input terminal
			else{
				
				inputs.append("rect")
					.classed("terminal input", true)
					.attr("width", 20) 
					.attr("height", height)
					.attr("x", curX) 
					.attr("y", curY + (i * 30)) 
					.attr("wireoffset_x", 0) 
					.attr("wireoffset_y", height/2)
					.attr("terminal_id", function(d) {return d.id})
					.append("svg:title")
					.text(function(d) { return d.id; });
			}
		}
	}
	
	inputs.append("polygon")
        .classed("terminal input state", true)
        .attr("points", curX + "," + curY + " 20," + (height/2).toFixed() + " 0," + height.toFixed())
	
	//add output elements to group	
    outputs
        .append("text")
        .classed("output label", true)
        .attr("x", curX) 
        .attr("y", curY) 
        .style("dy", "1em")
        .style("padding", padding)
        .text(function(d) { return d.label; }); 
	
	//if a single module
	if(moduleType === "single"){
		
		outputs.append("rect")
			.attr("transform", function(d,i) {return "translate(" + width.toFixed() + "," + (height * i).toFixed() + ")"}) 
			.classed("terminal output", true)
			.attr("width", 20) 
			.attr("height", height)
			.attr("x", curX ) 
			.attr("y", curY) 
			.attr("wireoffset_x", 20)
			.attr("wireoffset_y", height/2)
			.attr("terminal_id", function(d) {return d.id})
			.call(wireaction)
			.append("svg:title")
			.text(function(d) { return d.id; });
	}
	
	//if a part of a combined module
	else{
		
		//add the output terminals
		for(var i = 0; i < output_terminals.length; i++){
			
			 //if has an edge input terminal 		 	
			if(outputEdge){
				
				outputs.append("rect")
					.classed("terminal output", true)
					.attr("width", 20) 
					.attr("height", height)
					.attr("x", curX + width) 
					.attr("y", curY + (i * 30)) 
					.attr("wireoffset_x", 0) 
					.attr("wireoffset_y", height/2)
					.attr("terminal_id", function(d) {return d.id})
					.call(wireaction)
					.append("svg:title")
					.text(module_data.id); //.text(function(d) { return d.id; });
			}
			
			//if not an edge input terminal
			else{
				
				outputs.append("rect")
					.classed("terminal output", true)
					.attr("width", 20) 
					.attr("height", height)
					.attr("x", curX + width) 
					.attr("y", curY + (i * 30)) 
					.attr("wireoffset_x", 0) 
					.attr("wireoffset_y", height/2)
					.attr("terminal_id", function(d) {return d.id})
					.append("svg:title")
					.text(function(d) { return d.id; });
			}
		}
	}
	
    outputs.append("polygon")
        .classed("terminal input state", true)
        .attr("points", curX + "," + curY + " 20," + (height/2).toFixed() + " 0," + height.toFixed()) 
      
    //add title border last to make sure it's on top
    title.append("rect")
      .classed("title border", true)
      .attr("width", width)
      .attr("height", height)
      .attr("x", curX)
      .attr("y", curY)
	  
	return width;  
  }
	  
  //represents modules combined into one template
  function combinedModule(moduleType, group, padding, title, inputs, outputs, titletext, curX, curY, module_defs, inputEdge, outputEdge){
	
	var mods = svg.datum().modules;
	var wires = svg.datum().wires;
	var edgeSourceWires;
	var edgeSources = [];
    var edgeTargets = [];
	var curX = 0;
	var curY = 0;
	var addedModules = []
	var loc = 0;
	var numModulesAdded = 0;
	
	//go through the wires
    for (var i=0; i < wires.length; i++) {
			
        var w = wires[i]; 
		
		var curSource = (String(w.source)).split(",")[0];    
		var curTarget = (String(w.target)).split(",")[0];
		
		//if edge source is not there before
		if(edgeSources.indexOf(curSource) === -1)
			edgeSources.push(curSource);
		
		//if target source is not there before
		if(edgeTargets.indexOf(curTarget) === -1)
			edgeTargets.push(curTarget);
		
		mods[curSource].joinedOutput.push(curTarget); 
		mods[curTarget].joinedInput.push(curSource); 
    }
	
	//add the single modules into the template
	for(var i = 0; i < mods.length -1; i++)                          
		mods[mods.length - 1].innerModules.push(mods[i]);
	
	//------------------------------------------
	
	//go through the sources
	for(var i = 0; i < edgeSources.length; i++){
			
		//go through the targets
		for(var j = 0; j < edgeTargets.length; j++){
			
			var curSource = edgeSources[i];
			var curTarget = edgeTargets[j];
			
			//if module is a source and a target
			if(curSource === curTarget){  
			
				edgeSources.splice(i, 1);     
				edgeTargets.splice(j, 1);
				
				i--;
				j--;
			}
		}
	}
	
	//TO-DO: FIX THE Y COORDINATE
	
	inputEdge = true;
	outputEdge = false;
		
	curY = addModule(moduleType, group, padding, title, inputs, outputs, titletext, curX, curY, module_defs, inputEdge, outputEdge, edgeSources[0], wires, addedModules, mods, loc);
	var verticalSpace = 0;
	
	//go through the sources
	for(var i = 1; i < edgeSources.length; i++){
		
		//look at previous row to check to see if need to move up the y coordinate
		for(var j = numModulesAdded; j < addedModules.length; j++){ 
				
			var curModule = addedModules[j];
			var curWires = getTargetWires(wires, curModule);
			
			verticalSpace = Math.max(verticalSpace, getVerticalSpace(curModule, mods, module_defs, curWires, addedModules));
			
			//if the added module has more connected inputs
			if(curWires.length > 1){
				
				verticalSpace = getNumUsedInputs(curModule, mods, module_defs, curWires, addedModules); 
				break;
			}
		}
			
		curY += (verticalSpace -1) * 30;	
		verticalSpace = 0;
		numModulesAdded = addedModules.length;	
		inputEdge = true;
		outputEdge = false;
	
		curY = addModule(moduleType, group, padding, title, inputs, outputs, titletext, curX, curY, module_defs, inputEdge, outputEdge, edgeSources[i], wires, addedModules, mods, loc);
	}
  }
  
  //returns the vertical space needed for the module
  function getVerticalSpace(curModule, mods, module_defs, curWires, addedModules){ 
  
	var module_data = mods[parseInt(curModule)];
	var module_name = module_data.module;
	var module_def = module_data.module_def || module_defs[module_name] || {};
	var input_terminals = module_data.inputs || module_def.inputs || [],
		output_terminals = module_data.outputs || module_def.outputs || [];
	
	return Math.max(input_terminals.length, output_terminals.length);
  }
  
  //returns the number of used inputs that have been added for the module
  function getNumUsedInputs(curModule, mods, module_defs, curWires, addedModules){ 
	  
	var module_data = mods[parseInt(curModule)];
	var module_name = module_data.module;
	var module_def = module_data.module_def || module_defs[module_name] || {};
	var input_terminals = module_data.inputs || module_def.inputs || []
		
	var numUsedInputs = 0;
	
	//go through the wires
	for(var i = 0; i < curWires.length; i++){
		
		var curSource = String(curWires[i].source)[0];
		
		//go through the added modules so far
		for(var j = 0; j < addedModules.length; j++){
		
			//if found a used input module that has been added
			if(addedModules[j] === curSource)
				numUsedInputs++;
		}
	}
	
	return numUsedInputs;
  }
 
  //adds the modules (recursive if a module has multiple inputs or outputs wired)
  function addModule(moduleType, group, padding, title, inputs, outputs, titletext, curX, curY, module_defs, inputEdge, outputEdge, curModule, wires, addedModules, mods, loc){
	
	var module_data;
	var module_name;
	var module_def;
	var input_terminals;
	var output_terminals;
	var curWires = getSourceWires(wires, curModule);  

	//keep on adding the modules until reached the edge target 
	while(curWires.length !== 0 && addedModules.indexOf(curModule) === -1 && addedModules.length < (mods.length - 1)){ 
		
		module_data = mods[mods.length -1].innerModules[parseInt(curModule)];
		module_data.x = mods[mods.length -1].x
		module_data.y = mods[mods.length -1].y
				
		module_name = module_data.module;
		module_def = module_data.module_def || module_defs[module_name] || {};
				
		input_terminals = module_data.inputs || module_def.inputs || []
		output_terminals = module_data.outputs || module_def.outputs || [];
			
		//---------------------------
		
		var space = singleModule(moduleType, module_data, group, input_terminals, output_terminals, padding, title, inputs, outputs, titletext, curX, curY, module_defs, inputEdge, outputEdge, loc)
		addedModules.push(curModule);
			
		//recursively add the other connected modules
		for(var i = 1; i < curWires.length; i++){
			
			loc++;
			curY += 30;
			curX = curX + 40 + space;  
			inputEdge = false;
			outputEdge = false;
			addModule(moduleType, group, padding, title, inputs, outputs, titletext, curX, curY, module_defs, inputEdge, outputEdge,  String((curWires[loc].target)[0]), wires, addedModules, mods, loc);
			addedModules.push(String(curWires[loc].target)[0]);
		}
			
		//if has more than one input or output
		if(curWires.length > 1)
			curY -= (curWires.length - 1) * 30;
		
		//if has only one input and output
		else
			curX += space + 40; 
				
		curModule = String((curWires[0].target)[0]);
		curWires = getSourceWires(wires, curModule);                   
				
		inputEdge = false;  
		outputEdge = false;
	}
	
	//don't repeat modules --> add the edge output terminal
	if(addedModules.indexOf(curModule) === -1){
		
		inputEdge = false;
		outputEdge = true;
			
		module_data = mods[mods.length -1].innerModules[parseInt(curModule)];
			
		module_data.x = mods[mods.length -1].x
		module_data.y = mods[mods.length -1].y
				
		module_name = module_data.module;

		module_def = module_data.module_def || module_defs[module_name] || {};
		input_terminals = module_data.inputs || module_def.inputs || []
		output_terminals = module_data.outputs || module_def.outputs || [];
			
		//-------
		singleModule(moduleType, module_data, group, input_terminals, output_terminals, padding, title, inputs, outputs, titletext, curX, curY, module_defs, inputEdge, outputEdge)
		addedModules.push(curModule);
		curX = 0;
	}
	
	curY += 30;
	
	return curY;
  }
  
  //returns the wire that the module is the source of
  function getSourceWires(wires, source){
	
	var sourceWires = [];
	
	 //go through the wires
	 for(var i = 0; i < wires.length; i++){

		var curWire = wires[i];		
		
		//if found the wire
		if(String(curWire.source).split(",")[0] === source)
			sourceWires.push(curWire);
	  }
	  
	  return sourceWires;
  }
  
  //returns the wire that the module is the target of
  function getTargetWires(wires, target){
	
	var targetWires = [];
	
	 //go through the wires
	 for(var i = 0; i < wires.length; i++){

		var curWire = wires[i];		
		
		//if found the wire
		if(String(curWire.target).split(",")[0] === target)
			targetWires.push(curWire);
	  }
	  
	  return targetWires;
  }
  
  //returns whether the connector has a node
  function wire(wire_data) {
	  
    var connector = d3.select(this).append("path")
      .classed("wire", true);
	  
    return connector.node();
  }
  
  return editor;
}
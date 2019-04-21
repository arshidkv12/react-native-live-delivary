import React, { Component } from "react";
import {
  TextInput,
  StyleSheet,
  Text,
  View,
  Keyboard,
  TouchableHighlight
} from "react-native";import MapView, { Polyline, Marker } from "react-native-maps";
import Constants from "./Constants";
import MapConfig from "./MapConfig";
import _ from "lodash";
import PolyLine from "@mapbox/polyline";
import Geolocation from 'react-native-geolocation-service';
import haversine from 'haversine';

let pointCoords = [];
let points = []; 

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: "",
      latitude: 12.9166,
      longitude: 77.6101,
      destination: "",
      predictions: [],
      pointCoords: []
    };
    this.onChangeDestinationDebounced = _.debounce(
      this.onChangeDestination,
      1000
    );
  }

  componentDidMount() {
    //Get current location and set initial region to this
    // navigator.geolocation.getCurrentPosition(
    //   position => {
    //     this.setState({
    //       latitude: position.coords.latitude,
    //       longitude: position.coords.longitude
    //     });
    //   },
    //   error => console.error(error),
    //   { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    // );
    Geolocation.getCurrentPosition(
        (position) => {
          this.setState({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => { },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    this.watchID = Geolocation.watchPosition(
      position => {
        //const { coordinate, routeCoordinates, distanceTravelled } =   this.state;
        const { latitude, longitude } = position.coords;
        // let exist = _.findIndex(pointCoords, (o) => { 
        //   return _.isMatch(o, { latitude : position.coords.latitude, longitude:position.coords.longitude}) 
        // }) > -1;
        let inRoad = false;
        _.forEach(pointCoords, function(value) {
          if( inRoad ) return; 
          let roadAndPos = haversine(value,{latitude:latitude, longitude:longitude});
          inRoad = roadAndPos<0.02 ? true : false;
        });

        if(!inRoad && this.state.place_id){
          this.setState({latitude, longitude},
            ()=>this.getRouteDirections( this.state.destination )
          )
        } 

       // alert(exist)
        // const newCoordinate = {
        //   latitude,
        //   longitude
        // };
      },{ enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );

  }

  async getRouteDirections( destinationName) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${
          this.state.latitude
        },${
          this.state.longitude
        }&destination=place_id:${this.state.place_id}&key=${Constants.apiKey}`
      );
      const json = await response.json();
      points = PolyLine.decode(json.routes[0].overview_polyline.points);
      pointCoords = points.map(point => {
        return { latitude: point[0], longitude: point[1] };
      });
      this.setState({
        pointCoords,
        predictions: [],
        destination: destinationName
      });
      Keyboard.dismiss();
      this.map.fitToCoordinates(pointCoords);
    } catch (error) {
      console.error(error);
    }
  }

  async onChangeDestination(destination) {
    const apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?key=${Constants.apiKey}
    &input=${destination}&location=${this.state.latitude},${
      this.state.longitude
    }&radius=2000`;
    console.log(apiUrl);
    try {
      const result = await fetch(apiUrl);
      const json = await result.json();
      this.setState({
        predictions: json.predictions
      });
      console.log(json);
    } catch (err) {
      console.error(err);
    }
  }

  render() {
    let marker = null;

    if (this.state.pointCoords.length > 1) {
      marker =[
        <Marker key={'destination'}
          //icon={'./imgs/'}
          coordinate={this.state.pointCoords[this.state.pointCoords.length - 1]}
        />,
        <Marker key={'source'}
          coordinate={{latitude: this.state.latitude, longitude: this.state.longitude}}
        />
      ];
    }

    const predictions = this.state.predictions.map(prediction => (
      <TouchableHighlight
        onPress={() => 
          this.setState({
            place_id: prediction.place_id
          },()=>
          this.getRouteDirections(
            prediction.structured_formatting.main_text
          ))
        }
        key={prediction.id}
      >
        <View>
          <Text style={styles.suggestions}>
            {prediction.structured_formatting.main_text}
          </Text>
        </View>
      </TouchableHighlight>
    ));

    return (
      <View style={styles.container}>
        <MapView
          customMapStyle={MapConfig}
          ref={map => {
            this.map = map;
          }}
          style={styles.map}
          region={{
            latitude: this.state.latitude,
            longitude: this.state.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.0121
          }}
          showsUserLocation={true}
        >
          <Polyline
            coordinates={this.state.pointCoords}
            strokeWidth={5}
            strokeColor="#000"
          />
          {marker}
        </MapView>
        <TextInput
          placeholder="Enter destination..."
          style={styles.destinationInput}
          value={this.state.destination}
          clearButtonMode="always"
          onChangeText={destination => {
            console.log(destination);
            this.setState({ destination });
            this.onChangeDestinationDebounced(destination);
          }}
        />
        {predictions}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  suggestions: {
    backgroundColor: "white",
    padding: 5,
    fontSize: 18,
    borderWidth: 0.5,
    marginLeft: 5,
    marginRight: 5
  },
  destinationInput: {
    height: 40,
    borderWidth: 0.5,
    marginTop: 50,
    marginLeft: 5,
    marginRight: 5,
    padding: 5,
    backgroundColor: "white"
  },
  container: {
    ...StyleSheet.absoluteFillObject
  },
  map: {
    ...StyleSheet.absoluteFillObject
  }
});

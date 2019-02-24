import React from "react"
import { Link } from "gatsby"

class SideBar extends React.Component {
  render() {
    const { data } = this.props
    const posts = data.edges

    return (
        <ul className="Menu Menu--vertical">

        {posts.map(({ node }) => {
          const title = node.fields.slug.replace('/', '').replace('/', '');
          return (
            <li className="Menu-item" key={node.fields.slug}>              
              <Link className="Menu-link" to={node.fields.slug}>
                {title}
              </Link>
            </li>
          )
        })}
        </ul>
    )
  }
}

export default SideBar


